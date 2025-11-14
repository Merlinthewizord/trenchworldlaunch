import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';

const RPC_URL = process.env.RPC_URL as string;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!RPC_URL) {
        return res.status(500).json({
            error: 'Server configuration error',
            details: 'Missing required environment variable: RPC_URL'
        });
    }

    try {
        const { poolAddress: mintAddress } = req.body;

        if (!mintAddress) {
            return res.status(400).json({ error: 'Token mint address is required' });
        }

        console.log('Fetching creator fees for mint:', mintAddress);

        const connection = new Connection(RPC_URL, 'confirmed');
        const client = new DynamicBondingCurveClient(connection, 'confirmed');

        const mintOrPool = new PublicKey(mintAddress);

        // First, get the pool state by base mint (token address)
        // This will give us the actual pool address
        console.log('Getting pool by base mint:', mintOrPool.toBase58());
        const poolState = await client.state.getPoolByBaseMint(mintOrPool);

        if (!poolState) {
            throw new Error('Pool not found for this token');
        }

        const poolAddress = poolState.publicKey;
        console.log('Pool found:', poolAddress.toBase58());

        // Get fee metrics for the pool
        const metrics = await client.state.getPoolFeeMetrics(poolAddress);
        console.log('Fee metrics retrieved successfully');

        return res.status(200).json({
            creatorBaseFee: metrics.current.creatorBaseFee.toString(),
            creatorQuoteFee: metrics.current.creatorQuoteFee.toString(),
            totalTradingBaseFee: metrics.total.totalTradingBaseFee.toString(),
            totalTradingQuoteFee: metrics.total.totalTradingQuoteFee.toString(),
        });
    } catch (error) {
        console.error('Error fetching creator fees:', error);
        return res.status(500).json({
            error: 'Failed to fetch creator fees',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
