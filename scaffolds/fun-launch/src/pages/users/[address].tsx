import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';

interface TokenAccount {
    mint: string;
    amount: string;
    decimals: number;
    uiAmount: number;
    name?: string;
    symbol?: string;
    logo?: string;
}

export default function UserProfilePage() {
    const router = useRouter();
    const { address } = router.query;
    const [tokens, setTokens] = useState<TokenAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [solBalance, setSolBalance] = useState<number | null>(null);

    useEffect(() => {
        if (address && typeof address === 'string') {
            fetchUserData(address);
        }
    }, [address]);

    const fetchUserData = async (walletAddress: string) => {
        setLoading(true);
        try {
            // Fetch SOL balance
            const balanceRes = await fetch('/api/user/get-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: walletAddress }),
            });

            if (balanceRes.ok) {
                const balanceData = await balanceRes.json();
                setSolBalance(balanceData.balance);
            }

            // Fetch token accounts
            const tokensRes = await fetch('/api/user/get-tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: walletAddress }),
            });

            if (tokensRes.ok) {
                const tokensData = await tokensRes.json();
                setTokens(tokensData.tokens);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (num: number) => {
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
        return num.toFixed(2);
    };

    return (
        <>
            <Head>
                <title>User Profile - TrenchFun</title>
                <meta name="description" content="View user token holdings" />
            </Head>

            <div className="min-h-screen bg-black">
                <Header />

                <main className="container mx-auto px-4 py-8 max-w-7xl">
                    {/* Header Section */}
                    <div className="mb-8">
                        <Link href="/">
                            <Button className="mb-4 bg-white/5 hover:bg-white/10 border border-white/10">
                                ← Back
                            </Button>
                        </Link>

                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent mb-2">
                                    User Profile
                                </h1>
                                <p className="text-gray-400 font-mono text-sm break-all">
                                    {address}
                                </p>
                            </div>
                        </div>

                        {/* Balance Card */}
                        <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-6 backdrop-blur-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                                </svg>
                                <span className="text-sm text-gray-400 font-medium">SOL Balance</span>
                            </div>
                            <p className="text-4xl font-bold text-white">
                                {solBalance !== null ? solBalance.toFixed(4) : '...'} SOL
                            </p>
                            {solBalance !== null && (
                                <p className="text-sm text-gray-500 mt-2">
                                    ≈ ${(solBalance * 200).toFixed(2)} USD
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Tokens Section */}
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-white mb-4">Token Holdings</h2>
                    </div>

                    {loading ? (
                        <div className="text-center py-16">
                            <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-400">Loading tokens...</p>
                        </div>
                    ) : tokens.length === 0 ? (
                        <div className="bg-black/60 backdrop-blur-md border border-purple-500/10 rounded-xl p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No Tokens Found</h3>
                            <p className="text-gray-400">This wallet doesn't hold any tokens yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {tokens.map((token) => (
                                <div
                                    key={token.mint}
                                    className="bg-black/60 backdrop-blur-md border border-purple-500/10 rounded-xl p-4 hover:border-purple-500/30 transition-all"
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        {token.logo ? (
                                            <img
                                                src={token.logo}
                                                alt={token.symbol || 'Token'}
                                                className="w-12 h-12 rounded-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                                <span className="text-white font-bold text-sm">
                                                    {token.symbol?.[0] || '?'}
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-bold truncate">
                                                {token.symbol || 'Unknown'}
                                            </h3>
                                            <p className="text-xs text-gray-500 truncate font-mono">
                                                {token.mint.slice(0, 8)}...
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-500">Balance</span>
                                            <span className="text-white font-semibold">
                                                {formatNumber(token.uiAmount)}
                                            </span>
                                        </div>
                                    </div>

                                    <Link href={`/token/${token.mint}`}>
                                        <Button className="w-full mt-3 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500">
                                            View Token
                                        </Button>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </>
    );
}
