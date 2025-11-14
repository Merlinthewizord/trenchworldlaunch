import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useWallet } from '@jup-ag/wallet-adapter';
import { Transaction } from '@solana/web3.js';
import BN from 'bn.js';
import Header from '../components/Header';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type FeeMetrics = {
    poolAddress: string;
    partnerBaseFee: string;
    partnerQuoteFee: string;
    creatorBaseFee: string;
    creatorQuoteFee: string;
    totalTradingBaseFee: string;
    totalTradingQuoteFee: string;
};

export default function AdminDashboard() {
    const { publicKey, signTransaction } = useWallet();
    const [fees, setFees] = useState<FeeMetrics[]>([]);
    const [loading, setLoading] = useState(false);
    const [claiming, setClaiming] = useState<string | null>(null);
    const [claimingAll, setClaimingAll] = useState(false);
    const [configAddress, setConfigAddress] = useState<string>('');
    const [minSolThreshold, setMinSolThreshold] = useState<number>(0.1);

    // Fetch fees on mount and when wallet connects
    useEffect(() => {
        if (publicKey) {
            fetchFees();
        }
    }, [publicKey]);

    const fetchFees = async () => {
        setLoading(true);
        try {
            console.log('Fetching fees from /api/admin/get-fees...');
            const response = await fetch('/api/admin/get-fees').catch(err => {
                console.error('Fetch error:', err);
                throw err;
            });
            console.log('Response received:', response);
            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error response:', errorText);
                let error;
                try {
                    error = JSON.parse(errorText);
                } catch {
                    throw new Error(`Server error: ${response.status} - ${errorText}`);
                }
                throw new Error(error.error || error.details || 'Failed to fetch fees');
            }

            const data = await response.json();
            console.log('Fees data:', data);
            setFees(data.fees);
            setConfigAddress(data.configAddress);
            toast.success(`Loaded fees for ${data.fees.length} pools`);
        } catch (error) {
            console.error('Error fetching fees:', error);
            toast.error('Failed to fetch fees', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setLoading(false);
        }
    };

    const claimFees = async (poolAddress: string) => {
        if (!publicKey || !signTransaction) {
            toast.error('Please connect your wallet');
            return;
        }

        setClaiming(poolAddress);
        try {
            // Get the fee metrics for this pool to determine max amounts
            const feeMetric = fees.find(f => f.poolAddress === poolAddress);
            if (!feeMetric) {
                throw new Error('Fee metrics not found for pool');
            }


            // Request transaction from API
            const response = await fetch('/api/admin/claim-fees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    poolAddress,
                    payerAddress: publicKey.toBase58(),
                    maxBaseAmount: feeMetric.partnerBaseFee,
                    maxQuoteAmount: feeMetric.partnerQuoteFee,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create claim transaction');
            }

            const { transaction: txBase64 } = await response.json();

            // Deserialize and sign transaction
            const txBuffer = Buffer.from(txBase64, 'base64');
            const transaction = Transaction.from(txBuffer);

            // Sign the transaction with the wallet
            const signedTx = await signTransaction(transaction);

            // Send via our send-transaction API
            const sendResponse = await fetch('/api/send-transaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    signedTransaction: signedTx.serialize().toString('base64'),
                }),
            });

            if (!sendResponse.ok) {
                const error = await sendResponse.json();
                throw new Error(error.error || 'Failed to send transaction');
            }

            const { signature } = await sendResponse.json();

            toast.success('Fees claimed successfully!', {
                description: `Signature: ${signature.slice(0, 8)}...`,
            });

            // Refresh fees
            await fetchFees();
        } catch (error) {
            console.error('Error claiming fees:', error);
            toast.error('Failed to claim fees', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setClaiming(null);
        }
    };

    const claimAllFees = async () => {
        if (!publicKey || !signTransaction) {
            toast.error('Please connect your wallet');
            return;
        }

        // Convert SOL to lamports (1 SOL = 1000000000 lamports)
        const MIN_SOL_THRESHOLD = new BN(Math.floor(minSolThreshold * 1e9));

        // Filter pools that have claimable fees (more than threshold)
        const poolsWithFees = fees.filter(f => {
            const quoteFee = new BN(f.partnerQuoteFee);
            // Only claim if quote fee (SOL) is greater than or equal to threshold
            return quoteFee.gte(MIN_SOL_THRESHOLD);
        });

        if (poolsWithFees.length === 0) {
            toast.info(`No fees to claim (minimum ${minSolThreshold} SOL threshold)`);
            return;
        }

        toast.info(`Claiming fees from ${poolsWithFees.length} pool(s) with ≥${minSolThreshold} SOL`);

        setClaimingAll(true);
        let successCount = 0;
        let failCount = 0;

        for (const feeMetric of poolsWithFees) {
            try {
                // Request transaction from API
                const response = await fetch('/api/admin/claim-fees', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        poolAddress: feeMetric.poolAddress,
                        payerAddress: publicKey.toBase58(),
                        maxBaseAmount: feeMetric.partnerBaseFee,
                        maxQuoteAmount: feeMetric.partnerQuoteFee,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to create claim transaction');
                }

                const { transaction: txBase64 } = await response.json();

                const txBuffer = Buffer.from(txBase64, 'base64');
                const transaction = Transaction.from(txBuffer);

                const signedTx = await signTransaction(transaction);

                // Send transaction
                const sendResponse = await fetch('/api/send-transaction', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        signedTransaction: signedTx.serialize().toString('base64'),
                    }),
                });

                if (!sendResponse.ok) {
                    throw new Error('Failed to send transaction');
                }

                successCount++;
                toast.success(`Claimed fees from pool ${feeMetric.poolAddress.slice(0, 8)}...`);
            } catch (error) {
                console.error(`Error claiming fees from pool ${feeMetric.poolAddress}:`, error);
                failCount++;
            }
        }

        setClaimingAll(false);

        if (successCount > 0) {
            toast.success(`Successfully claimed fees from ${successCount} pool(s)`);
        }
        if (failCount > 0) {
            toast.error(`Failed to claim fees from ${failCount} pool(s)`);
        }

        // Refresh fees
        await fetchFees();
    };

    // Format lamports to SOL
    const formatSol = (lamportsStr: string) => {
        const lamports = new BN(lamportsStr);
        return (lamports.toNumber() / 1e9).toFixed(9);
    };

    // Calculate totals
    const totalPartnerQuoteFee = fees.reduce((sum, f) => sum.add(new BN(f.partnerQuoteFee)), new BN(0));
    const totalPartnerBaseFee = fees.reduce((sum, f) => sum.add(new BN(f.partnerBaseFee)), new BN(0));
    const totalCreatorQuoteFee = fees.reduce((sum, f) => sum.add(new BN(f.creatorQuoteFee)), new BN(0));
    const totalCreatorBaseFee = fees.reduce((sum, f) => sum.add(new BN(f.creatorBaseFee)), new BN(0));

    return (
        <>
            <Head>
                <title>Admin Dashboard - Fee Management</title>
                <meta name="description" content="Manage trading fees" />
            </Head>

            <div className="min-h-screen bg-black">
                <Header />

                <main className="container mx-auto px-4 py-8 max-w-7xl">
                    {/* Header Section */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                                    Admin Dashboard
                                </h1>
                                <p className="text-gray-400 mt-1">Manage and claim trading fees from all pools</p>
                            </div>
                        </div>
                    </div>

                    {!publicKey ? (
                        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-12 text-center backdrop-blur-sm">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Authentication Required</h2>
                            <p className="text-xl text-gray-300 mb-6">Please connect your admin wallet to access the dashboard</p>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-purple-500/40 transition-all">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-gray-400 font-medium">Total Pools</p>
                                    </div>
                                    <p className="text-4xl font-bold text-white">{fees.length}</p>
                                </div>

                                <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-green-500/40 transition-all">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-gray-400 font-medium">Partner Fees (SOL)</p>
                                    </div>
                                    <p className="text-4xl font-bold text-white">{formatSol(totalPartnerQuoteFee.toString())}</p>
                                    <p className="text-xs text-gray-500 mt-1">≈ ${(parseFloat(formatSol(totalPartnerQuoteFee.toString())) * 200).toFixed(2)} USD</p>
                                </div>

                                <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-orange-500/40 transition-all">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-gray-400 font-medium">Partner Fees (Token)</p>
                                    </div>
                                    <p className="text-4xl font-bold text-white">{formatSol(totalPartnerBaseFee.toString())}</p>
                                    <p className="text-xs text-gray-500 mt-1">Base token fees</p>
                                </div>

                                <div className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-6 backdrop-blur-sm hover:border-pink-500/40 transition-all">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-gray-400 font-medium">Creator Fees (SOL)</p>
                                    </div>
                                    <p className="text-4xl font-bold text-white">{formatSol(totalCreatorQuoteFee.toString())}</p>
                                    <p className="text-xs text-gray-500 mt-1">Total creator earnings</p>
                                </div>
                            </div>

                            {/* Actions Bar */}
                            <div className="bg-black/60 backdrop-blur-md border border-purple-500/20 rounded-xl p-6 mb-6">
                                <div className="flex flex-wrap gap-4 items-end">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-2 block">Quick Actions</label>
                                        <Button
                                            onClick={fetchFees}
                                            disabled={loading}
                                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-500/20"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            {loading ? 'Refreshing...' : 'Refresh Data'}
                                        </Button>
                                    </div>

                                    <div className="flex-1 min-w-[200px]">
                                        <label htmlFor="minThreshold" className="text-xs text-gray-400 mb-2 block">
                                            Minimum Claim Threshold
                                        </label>
                                        <div className="flex gap-2 items-center">
                                            <div className="relative flex-1">
                                                <input
                                                    id="minThreshold"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={minSolThreshold}
                                                    onChange={(e) => setMinSolThreshold(parseFloat(e.target.value) || 0)}
                                                    className="w-full px-4 py-2.5 bg-black/60 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">SOL</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={claimAllFees}
                                        disabled={claimingAll || loading || fees.length === 0}
                                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/20 px-6"
                                    >
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {claimingAll ? 'Processing...' : `Claim All (≥${minSolThreshold} SOL)`}
                                    </Button>
                                </div>
                            </div>                            {/* Fee Table */}
                            <div className="bg-black/60 backdrop-blur-md border border-purple-500/10 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-purple-500/5 border-b border-purple-500/10">
                                            <tr>
                                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pool</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Partner SOL</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Partner Token</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Creator SOL</th>
                                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Creator Token</th>
                                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-purple-500/10">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-12 h-12 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin"></div>
                                                            <p className="text-gray-400">Loading fee data...</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : fees.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                                                                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                                                </svg>
                                                            </div>
                                                            <div>
                                                                <p className="text-lg font-semibold text-white mb-1">No Pools Found</p>
                                                                <p className="text-sm text-gray-400">Create some pools to start earning fees</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                fees.map((fee) => {
                                                    const quoteFee = new BN(fee.partnerQuoteFee);
                                                    const baseFee = new BN(fee.partnerBaseFee);
                                                    const hasClaimableFees = !quoteFee.isZero() || !baseFee.isZero();
                                                    const meetsThreshold = quoteFee.gte(new BN(Math.floor(minSolThreshold * 1e9)));

                                                    return (
                                                        <tr key={fee.poolAddress} className="hover:bg-purple-500/5 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <a
                                                                    href={`https://solscan.io/account/${fee.poolAddress}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2 group"
                                                                >
                                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                                                        <span className="text-white text-xs font-bold">{fee.poolAddress[0]}</span>
                                                                    </div>
                                                                    <span className="font-mono text-sm text-blue-400 group-hover:text-blue-300 transition-colors">
                                                                        {fee.poolAddress.slice(0, 8)}...{fee.poolAddress.slice(-8)}
                                                                    </span>
                                                                    <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                    </svg>
                                                                </a>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex flex-col items-end gap-1">
                                                                    <span className={`font-mono text-sm font-semibold ${meetsThreshold ? 'text-green-400' : 'text-white'}`}>
                                                                        {formatSol(fee.partnerQuoteFee)}
                                                                    </span>
                                                                    <span className="text-xs text-gray-500">SOL</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="font-mono text-sm text-white">{formatSol(fee.partnerBaseFee)}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="font-mono text-sm text-white">{formatSol(fee.creatorQuoteFee)}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="font-mono text-sm text-white">{formatSol(fee.creatorBaseFee)}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center">
                                                                <Button
                                                                    onClick={() => claimFees(fee.poolAddress)}
                                                                    disabled={!hasClaimableFees || claiming === fee.poolAddress}
                                                                    className={hasClaimableFees
                                                                        ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/20"
                                                                        : "bg-gray-800 text-gray-500 cursor-not-allowed"
                                                                    }
                                                                >
                                                                    {claiming === fee.poolAddress ? (
                                                                        <>
                                                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                                                                            Claiming...
                                                                        </>
                                                                    ) : hasClaimableFees ? (
                                                                        <>
                                                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                            </svg>
                                                                            Claim Fees
                                                                        </>
                                                                    ) : 'No Fees'}
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Info Section */}
                            <div className="mt-8 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-semibold mb-2">Dashboard Information</h3>
                                        <div className="space-y-2 text-sm text-gray-300">
                                            <p>
                                                • This dashboard displays trading fees from all pools under config:
                                                <code className="mx-1 px-2 py-0.5 bg-black/40 rounded text-blue-400 font-mono text-xs">
                                                    {configAddress.slice(0, 12)}...{configAddress.slice(-8)}
                                                </code>
                                            </p>
                                            <p>• Only the designated fee claimer wallet can claim partner fees</p>
                                            <p>• Fees are automatically accumulated from trading activity on each pool</p>
                                            <p>• Set a minimum threshold to batch claim fees efficiently</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </>
    );
}
