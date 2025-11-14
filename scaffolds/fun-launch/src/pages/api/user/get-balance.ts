import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const RPC_URL = process.env.RPC_URL as string;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { address } = req.body;

    if (!address) {
        return res.status(400).json({ error: 'Address is required' });
    }

    if (!RPC_URL) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        const publicKey = new PublicKey(address);

        const balanceLamports = await connection.getBalance(publicKey);
        const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

        return res.status(200).json({ balance: balanceSol });
    } catch (error) {
        console.error('Error fetching balance:', error);
        return res.status(500).json({
            error: 'Failed to fetch balance',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
