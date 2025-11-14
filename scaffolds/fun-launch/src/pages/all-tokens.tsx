import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '../components/Header';
import { Button } from '@/components/ui/button';
import { usePoolsCache } from '@/contexts/PoolsCacheProvider';

export default function AllTokensPage() {
    const { pools, loading, lastFetch, fetchPools } = usePoolsCache();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        // Fetch pools on mount (will use cache if available)
        fetchPools();
    }, [fetchPools]);

    // Filter pools based on search query
    const filteredPools = pools.filter(pool => {
        const searchLower = searchQuery.toLowerCase();
        return (
            pool.address.toLowerCase().includes(searchLower) ||
            pool.baseMint.toLowerCase().includes(searchLower) ||
            pool.creator.toLowerCase().includes(searchLower) ||
            pool.metadata?.name.toLowerCase().includes(searchLower) ||
            pool.metadata?.symbol.toLowerCase().includes(searchLower)
        );
    });

    const formatTokenAmount = (amount: string, decimals: number = 9) => {
        const num = parseFloat(amount) / Math.pow(10, decimals);
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
        return num.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
        });
    };

    return (
        <>
            <Head>
                <title>All Tokens - TrenchFun</title>
                <meta name="description" content="View all tokens on TrenchFun" />
            </Head>

            <div className="min-h-screen bg-black">
                <Header />

                <main className="container mx-auto px-4 py-8 max-w-7xl">
                    {/* Header */}
                    <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                                All Tokens
                            </h1>
                            <p className="text-gray-400">
                                Browse all {pools.length} tokens launched on TrenchFun
                            </p>
                        </div>
                        <Link href="/">
                            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500">
                                ← Back to Home
                            </Button>
                        </Link>
                    </div>

                    {/* Controls */}
                    <div className="mb-6 flex flex-col md:flex-row gap-4">
                        {/* Search Bar */}
                        <div className="flex-1">
                            <input
                                type="text"
                                placeholder="Search by name, symbol, or address..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full px-4 py-3 bg-black/60 border border-purple-500/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-gray-500"
                            />
                        </div>

                        {/* Refresh */}
                        <div className="flex gap-2">
                            <Button onClick={() => fetchPools(true)} disabled={loading}>
                                {loading ? '...' : '↻ Refresh'}
                            </Button>
                            {lastFetch && !loading && (
                                <span className="text-xs text-gray-500 self-center">
                                    Updated {Math.floor((Date.now() - lastFetch) / 1000)}s ago
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Token Grid */}
                    {loading ? (
                        <div className="text-center py-16 text-gray-400">
                            Loading tokens...
                        </div>
                    ) : filteredPools.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            {searchQuery ? 'No tokens found matching your search' : 'No tokens found'}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredPools.map((pool) => (
                                    <Link
                                        key={pool.address}
                                        href={`/token/${pool.baseMint}`}
                                        className="block"
                                    >
                                        <div className="bg-black/60 backdrop-blur-md border border-purple-500/10 rounded-xl p-4 hover:border-purple-500/30 hover:bg-black/80 transition-all cursor-pointer h-full flex flex-col">
                                            {/* Token Icon and Info */}
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="shrink-0">
                                                    {pool.metadata?.logo ? (
                                                        <img
                                                            src={pool.metadata.logo}
                                                            alt={pool.metadata.name}
                                                            className="w-14 h-14 rounded-full object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.src = '/coins/default.png';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                                                            {pool.metadata?.symbol?.[0] || pool.metadata?.name?.[0] || '?'}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-bold text-white truncate">
                                                        {pool.metadata?.symbol || pool.metadata?.name || 'Unknown Token'}
                                                    </h3>
                                                    <p className="text-sm text-gray-400 truncate">
                                                        {pool.metadata?.name || pool.baseMint.slice(0, 8) + '...'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Website Link */}
                                            {pool.metadata?.website && (
                                                <div className="mb-3">
                                                    <a
                                                        href={pool.metadata.website}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                                    >
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z" />
                                                            <path d="M10 5c-2.761 0-5 2.239-5 5s2.239 5 5 5 5-2.239 5-5-2.239-5-5-5zm0 8c-1.654 0-3-1.346-3-3s1.346-3 3-3 3 1.346 3 3-1.346 3-3 3z" />
                                                        </svg>
                                                        Website
                                                    </a>
                                                </div>
                                            )}

                                            {/* Stats */}
                                            <div className="mt-auto space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Liquidity</span>
                                                    <span className="text-white font-semibold">
                                                        {formatTokenAmount(pool.quoteReserve)} SOL
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Supply</span>
                                                    <span className="text-white font-semibold">
                                                        {formatTokenAmount(pool.baseReserve)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>

                            {/* Results Info */}
                            {searchQuery && (
                                <div className="mt-6 text-sm text-gray-400 text-center">
                                    Showing {filteredPools.length} of {pools.length} tokens
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>
        </>
    );
}
