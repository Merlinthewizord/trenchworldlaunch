import { NextApiRequest, NextApiResponse } from 'next';
import { Connection, PublicKey } from '@solana/web3.js';

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

        // Get token accounts
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
        });

        // Fetch metadata for each token using Helius DAS API
        const tokensWithMetadata = await Promise.all(
            tokenAccounts.value
                .filter(account => account.account.data.parsed.info.tokenAmount.uiAmount > 0)
                .map(async (account) => {
                    const tokenInfo = account.account.data.parsed.info;
                    const mint = tokenInfo.mint;

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
                                    id: mint,
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
                                logo: asset.content?.files?.[0]?.uri || asset.content?.links?.image || '',
                            };
                        }

                        return {
                            mint,
                            amount: tokenInfo.tokenAmount.amount,
                            decimals: tokenInfo.tokenAmount.decimals,
                            uiAmount: tokenInfo.tokenAmount.uiAmount,
                            name: metadata?.name,
                            symbol: metadata?.symbol,
                            logo: metadata?.logo,
                        };
                    } catch (error) {
                        console.error(`Failed to fetch metadata for ${mint}:`, error);
                        return {
                            mint,
                            amount: tokenInfo.tokenAmount.amount,
                            decimals: tokenInfo.tokenAmount.decimals,
                            uiAmount: tokenInfo.tokenAmount.uiAmount,
                        };
                    }
                })
        );

        return res.status(200).json({ tokens: tokensWithMetadata });
    } catch (error) {
        console.error('Error fetching tokens:', error);
        return res.status(500).json({
            error: 'Failed to fetch tokens',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
