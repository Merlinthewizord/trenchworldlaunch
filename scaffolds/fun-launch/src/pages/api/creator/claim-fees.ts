import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';

const RPC_URL = process.env.RPC_URL as string;

type ClaimCreatorFeesRequest = {
    poolAddress: string;
    creatorAddress: string;
    maxBaseAmount: string;
    maxQuoteAmount: string;
};

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
        const {
            poolAddress,
            creatorAddress,
            maxBaseAmount,
            maxQuoteAmount,
        } = req.body as ClaimCreatorFeesRequest;

        if (!poolAddress || !creatorAddress || maxBaseAmount === undefined || maxQuoteAmount === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const connection = new Connection(RPC_URL, 'confirmed');
        const client = new DynamicBondingCurveClient(connection, 'confirmed');

        const mintOrPool = new PublicKey(poolAddress);
        const creator = new PublicKey(creatorAddress);

        // First, get the pool state by base mint (token address)
        console.log('Getting pool by base mint:', mintOrPool.toBase58());
        const poolState = await client.state.getPoolByBaseMint(mintOrPool);

        if (!poolState) {
            throw new Error('Pool not found for this token');
        }

        const pool = poolState.publicKey;
        console.log('Pool found:', pool.toBase58());

        // Create the claim transaction
        const transaction = await client.creator.claimCreatorTradingFee({
            pool,
            creator,
            payer: creator,
            maxBaseAmount: new BN(maxBaseAmount),
            maxQuoteAmount: new BN(maxQuoteAmount),
        });

        // Get latest blockhash and set fee payer
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = creator;

        // Serialize the transaction without signatures
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        return res.status(200).json({
            transaction: serializedTransaction.toString('base64'),
            blockhash,
            lastValidBlockHeight,
        });
    } catch (error) {
        console.error('Error creating creator claim transaction:', error);
        return res.status(500).json({
            error: 'Failed to create creator claim transaction',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
