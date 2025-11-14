import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';

type ClaimFeesRequest = {
    poolAddress: string;
    feeClaimerAddress: string;
    maxBaseAmount: string;
    maxQuoteAmount: string;
    receiverAddress?: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const RPC_URL = process.env.RPC_URL as string;

    if (!RPC_URL) {
        return res.status(500).json({
            error: 'Server configuration error',
            details: 'Missing required environment variable: RPC_URL'
        });
    }

    try {
        const {
            poolAddress,
            feeClaimerAddress,
            maxBaseAmount,
            maxQuoteAmount,
            receiverAddress,
        } = req.body as ClaimFeesRequest;

        if (!poolAddress || !feeClaimerAddress || maxBaseAmount === undefined || maxQuoteAmount === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const connection = new Connection(RPC_URL, 'confirmed');
        const client = new DynamicBondingCurveClient(connection, 'confirmed');

        const pool = new PublicKey(poolAddress);
        const feeClaimer = new PublicKey(feeClaimerAddress);
        const receiver = receiverAddress ? new PublicKey(receiverAddress) : null;

        // Create the claim transaction
        const transaction = await client.partner.claimPartnerTradingFee2({
            pool,
            feeClaimer,
            payer: feeClaimer,
            maxBaseAmount: new BN(maxBaseAmount),
            maxQuoteAmount: new BN(maxQuoteAmount),
            receiver,
        });

        // Get latest blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = feeClaimer;

        // Serialize the transaction and return it
        const serializedTransaction = transaction.serialize({
            requireAllSignatures: false,
            verifySignatures: false,
        });

        return res.status(200).json({
            transaction: serializedTransaction.toString('base64'),
        });
    } catch (error) {
        console.error('Error creating claim transaction:', error);
        return res.status(500).json({
            error: 'Failed to create claim transaction',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
