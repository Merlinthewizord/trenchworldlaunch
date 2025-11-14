import { NextApiRequest, NextApiResponse } from 'next';

const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS as string;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ADMIN_ADDRESS) {
        return res.status(500).json({ error: 'Admin address not configured' });
    }

    return res.status(200).json({ adminAddress: ADMIN_ADDRESS });
}
