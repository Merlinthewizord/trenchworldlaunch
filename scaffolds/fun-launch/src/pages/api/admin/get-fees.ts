import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';

type FeeMetricsResponse = {
    poolAddress: string;
    partnerBaseFee: string;
    partnerQuoteFee: string;
    creatorBaseFee: string;
    creatorQuoteFee: string;
    totalTradingBaseFee: string;
    totalTradingQuoteFee: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const RPC_URL = process.env.RPC_URL as string;
    const POOL_CONFIG_KEY = process.env.POOL_CONFIG_KEY as string;

    if (!RPC_URL || !POOL_CONFIG_KEY) {
        console.error('Missing environment variables:', { RPC_URL: !!RPC_URL, POOL_CONFIG_KEY: !!POOL_CONFIG_KEY });
        return res.status(500).json({
            error: 'Server configuration error',
            details: 'Missing required environment variables: RPC_URL or POOL_CONFIG_KEY'
        });
    }

    try {
        // Use Helius v2 endpoint for pagination support
        const heliusUrl = RPC_URL.replace('/v1/', '/v2/').replace('?api-key=', '/rpc?api-key=');
        const connection = new Connection(heliusUrl, 'confirmed');
        const client = new DynamicBondingCurveClient(connection, 'confirmed');
        const configAddress = new PublicKey(POOL_CONFIG_KEY);

        const feeMetrics = await client.state.getPoolsFeesByConfig(configAddress);

        // Convert BN values to strings for JSON serialization
        const response: FeeMetricsResponse[] = feeMetrics.map(fee => ({
            poolAddress: fee.poolAddress.toBase58(),
            partnerBaseFee: fee.partnerBaseFee.toString(),
            partnerQuoteFee: fee.partnerQuoteFee.toString(),
            creatorBaseFee: fee.creatorBaseFee.toString(),
            creatorQuoteFee: fee.creatorQuoteFee.toString(),
            totalTradingBaseFee: fee.totalTradingBaseFee.toString(),
            totalTradingQuoteFee: fee.totalTradingQuoteFee.toString(),
        }));

        return res.status(200).json({ fees: response, configAddress: POOL_CONFIG_KEY });
    } catch (error) {
        console.error('Error fetching fees:', error);
        return res.status(500).json({
            error: 'Failed to fetch fees',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
