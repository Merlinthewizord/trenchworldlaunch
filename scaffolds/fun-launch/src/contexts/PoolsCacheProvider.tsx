import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface Pool {
    address: string;
    config: string;
    baseMint: string;
    creator: string;
    baseReserve: string;
    quoteReserve: string;
    metadata: {
        name: string;
        symbol: string;
        website: string;
        logo: string;
    } | null;
}

interface PoolsCacheContextType {
    pools: Pool[];
    loading: boolean;
    error: string | null;
    lastFetch: number | null;
    fetchPools: (forceRefresh?: boolean) => Promise<void>;
}

const PoolsCacheContext = createContext<PoolsCacheContextType | undefined>(undefined);

const CACHE_KEY = 'trenchfun_pools_cache';
const CACHE_DURATION_MS = 60 * 1000; // 1 minute

export function PoolsCacheProvider({ children }: { children: React.ReactNode }) {
    const [pools, setPools] = useState<Pool[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastFetch, setLastFetch] = useState<number | null>(null);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { pools: cachedPools, timestamp } = JSON.parse(cached);
                const now = Date.now();

                // Only use cache if it's still valid
                if (now - timestamp < CACHE_DURATION_MS) {
                    setPools(cachedPools);
                    setLastFetch(timestamp);
                    console.log('Loaded pools from localStorage cache');
                }
            }
        } catch (err) {
            console.error('Failed to load cache from localStorage:', err);
        }
    }, []);

    const fetchPools = useCallback(async (forceRefresh = false) => {
        // Check if we need to fetch
        const now = Date.now();
        if (!forceRefresh && lastFetch && (now - lastFetch) < CACHE_DURATION_MS) {
            console.log('Using cached pool data, skipping fetch');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/pools/get-all');

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch pools');
            }

            const data = await response.json();
            const fetchTime = Date.now();

            setPools(data.pools);
            setLastFetch(fetchTime);

            // Save to localStorage
            try {
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    pools: data.pools,
                    timestamp: fetchTime
                }));
            } catch (err) {
                console.error('Failed to save cache to localStorage:', err);
            }

            console.log(`Fetched ${data.pools.length} pools (cached: ${data.cached})`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            setError(errorMessage);
            console.error('Error fetching pools:', err);
        } finally {
            setLoading(false);
        }
    }, [lastFetch]);

    const value: PoolsCacheContextType = {
        pools,
        loading,
        error,
        lastFetch,
        fetchPools,
    };

    return (
        <PoolsCacheContext.Provider value={value}>
            {children}
        </PoolsCacheContext.Provider>
    );
}

export function usePoolsCache() {
    const context = useContext(PoolsCacheContext);
    if (context === undefined) {
        throw new Error('usePoolsCache must be used within a PoolsCacheProvider');
    }
    return context;
}
