import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

const RPC_URL = process.env.RPC_URL as string;
const POOL_CONFIG_KEY = process.env.POOL_CONFIG_KEY as string;

// Cache configuration
const CACHE_DURATION_MS = 60 * 1000; // 1 minute cache
let cachedData: {
    pools: any[];
    timestamp: number;
} | null = null;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check if we have valid cached data
    const now = Date.now();
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION_MS) {
        console.log('Returning cached pool data');
        // Set cache headers
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        return res.status(200).json({
            pools: cachedData.pools,
            count: cachedData.pools.length,
            cached: true,
            cacheAge: Math.floor((now - cachedData.timestamp) / 1000)
        });
    }

    if (!RPC_URL || !POOL_CONFIG_KEY) {
        console.error('Missing environment variables: RPC_URL or POOL_CONFIG_KEY');
        return res.status(500).json({
            error: 'Server configuration error',
            details: 'Missing required environment variables'
        });
    }

    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const client = new DynamicBondingCurveClient(connection, 'confirmed');

        // Get all pools for this config
        const pools = await client.state.getPoolsByConfig(new PublicKey(POOL_CONFIG_KEY));

        // Fetch metadata for all pools in parallel using Helius DAS API
        const poolsWithMetadata = await Promise.all(
            pools.map(async (pool) => {
                try {
                    // Use Helius DAS API to get asset metadata
                    const response = await fetch(RPC_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 'get-asset',
                            method: 'getAsset',
                            params: {
                                id: pool.account.baseMint.toBase58(),
                            },
                        }),
                    });

                    const data = await response.json();

                    let metadata = null;
                    if (data.result && !data.error) {
                        const asset = data.result;
                        metadata = {
                            name: asset.content?.metadata?.name || 'Unknown Token',
                            symbol: asset.content?.metadata?.symbol || '',
                            website: asset.content?.links?.external_url || '',
                            logo: asset.content?.files?.[0]?.uri || asset.content?.links?.image || '',
                        };
                    }

                    return {
                        address: pool.publicKey.toBase58(),
                        config: pool.account.config.toBase58(),
                        baseMint: pool.account.baseMint.toBase58(),
                        creator: pool.account.creator.toBase58(),
                        baseReserve: pool.account.baseReserve.toString(),
                        quoteReserve: pool.account.quoteReserve.toString(),
                        metadata,
                    };
                } catch (error) {
                    // If metadata fetch fails, return pool without metadata
                    console.error(`Failed to fetch metadata for pool ${pool.publicKey.toBase58()}:`, error);
                    return {
                        address: pool.publicKey.toBase58(),
                        config: pool.account.config.toBase58(),
                        baseMint: pool.account.baseMint.toBase58(),
                        creator: pool.account.creator.toBase58(),
                        baseReserve: pool.account.baseReserve.toString(),
                        quoteReserve: pool.account.quoteReserve.toString(),
                        metadata: null,
                    };
                }
            })
        );

        // Update cache
        cachedData = {
            pools: poolsWithMetadata,
            timestamp: Date.now()
        };

        console.log(`Fetched and cached ${poolsWithMetadata.length} pools`);

        // Set cache headers
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

        return res.status(200).json({
            pools: poolsWithMetadata,
            count: poolsWithMetadata.length,
            cached: false
        });
    } catch (error) {
        console.error('Error fetching all pools:', error);
        return res.status(500).json({
            error: 'Failed to fetch pools',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
