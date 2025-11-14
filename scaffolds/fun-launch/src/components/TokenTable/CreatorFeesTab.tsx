import { useEffect, useState } from 'react';
import { useWallet } from '@jup-ag/wallet-adapter';
import { Transaction } from '@solana/web3.js';
import BN from 'bn.js';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useTokenInfo } from '@/hooks/queries';

type CreatorFees = {
    creatorBaseFee: string;
    creatorQuoteFee: string;
    totalTradingBaseFee: string;
    totalTradingQuoteFee: string;
};

export const CreatorFeesTab = () => {
    const { publicKey, signTransaction } = useWallet();
    const { data: tokenData } = useTokenInfo();
    const [fees, setFees] = useState<CreatorFees | null>(null);
    const [loading, setLoading] = useState(false);
    const [claiming, setClaiming] = useState(false);

    const poolAddress = tokenData?.id;
    const creatorAddress = tokenData?.baseAsset?.dev;
    const isCreator = publicKey && creatorAddress && publicKey.toBase58() === creatorAddress;

    useEffect(() => {
        if (poolAddress && isCreator) {
            fetchCreatorFees();
        }
    }, [poolAddress, isCreator]);

    const fetchCreatorFees = async () => {
        if (!poolAddress) return;

        console.log('Fetching creator fees for poolAddress:', poolAddress);
        console.log('Creator address:', creatorAddress);
        console.log('Token data:', tokenData);

        setLoading(true);
        try {
            const response = await fetch('/api/creator/get-fees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ poolAddress }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to fetch creator fees');
            }

            const data = await response.json();
            setFees(data);
        } catch (error) {
            console.error('Error fetching creator fees:', error);
            toast.error('Failed to fetch creator fees', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setLoading(false);
        }
    };

    const claimFees = async () => {
        if (!publicKey || !signTransaction || !poolAddress || !fees) {
            toast.error('Please connect your wallet');
            return;
        }

        setClaiming(true);
        try {
            // Request transaction from API
            const response = await fetch('/api/creator/claim-fees', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    poolAddress,
                    creatorAddress: publicKey.toBase58(),
                    maxBaseAmount: fees.creatorBaseFee,
                    maxQuoteAmount: fees.creatorQuoteFee,
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

            const signedTx = await signTransaction(transaction);

            // Send via send-transaction API
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

            toast.success('Creator fees claimed successfully!', {
                description: `Signature: ${signature.slice(0, 8)}...`,
            });

            // Refresh fees
            await fetchCreatorFees();
        } catch (error) {
            console.error('Error claiming creator fees:', error);
            toast.error('Failed to claim creator fees', {
                description: error instanceof Error ? error.message : 'Unknown error',
            });
        } finally {
            setClaiming(false);
        }
    };

    const formatSol = (lamportsStr: string) => {
        const lamports = new BN(lamportsStr);
        return (lamports.toNumber() / 1e9).toFixed(9);
    };

    // Only show this tab to the creator
    if (!isCreator) {
        return null;
    }

    const hasClaimableFees = fees && (!new BN(fees.creatorQuoteFee).isZero() || !new BN(fees.creatorBaseFee).isZero());

    return (
        <div className="flex flex-col h-full p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Creator Fees</h2>
                            <p className="text-sm text-gray-400">Claim your trading fee rewards</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="w-12 h-12 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-400">Loading fee data...</p>
                    </div>
                ) : fees ? (
                    <>
                        {/* Fee Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Claimable SOL Fees */}
                            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium">Claimable SOL</p>
                                </div>
                                <p className="text-3xl font-bold text-white mb-1">
                                    {formatSol(fees.creatorQuoteFee)}
                                </p>
                                <p className="text-xs text-gray-500">
                                    ≈ ${(parseFloat(formatSol(fees.creatorQuoteFee)) * 200).toFixed(2)} USD
                                </p>
                            </div>

                            {/* Claimable Token Fees */}
                            <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-6 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium">Claimable Tokens</p>
                                </div>
                                <p className="text-3xl font-bold text-white mb-1">
                                    {formatSol(fees.creatorBaseFee)}
                                </p>
                                <p className="text-xs text-gray-500">Base token fees</p>
                            </div>

                            {/* Total SOL Fees */}
                            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-6 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium">Total Trading SOL</p>
                                </div>
                                <p className="text-3xl font-bold text-white mb-1">
                                    {formatSol(fees.totalTradingQuoteFee)}
                                </p>
                                <p className="text-xs text-gray-500">All-time SOL fees</p>
                            </div>

                            {/* Total Token Fees */}
                            <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-xl p-6 backdrop-blur-sm">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium">Total Trading Tokens</p>
                                </div>
                                <p className="text-3xl font-bold text-white mb-1">
                                    {formatSol(fees.totalTradingBaseFee)}
                                </p>
                                <p className="text-xs text-gray-500">All-time token fees</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button
                                onClick={fetchCreatorFees}
                                disabled={loading}
                                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </Button>

                            <Button
                                onClick={claimFees}
                                disabled={!hasClaimableFees || claiming || loading}
                                className={hasClaimableFees
                                    ? "flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/20"
                                    : "flex-1 bg-gray-800 text-gray-500 cursor-not-allowed"
                                }
                            >
                                {claiming ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                                        Claiming...
                                    </>
                                ) : hasClaimableFees ? (
                                    <div className='flex items-center justify-center'>
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Claim All Fees
                                    </div>
                                ) : 'No Fees to Claim'}
                            </Button>
                        </div>

                        {/* Info Section */}
                        <div className="mt-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 backdrop-blur-sm">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-gray-300">
                                        As the pool creator, you earn a percentage of all trading fees. These fees accumulate automatically and can be claimed at any time.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-12">
                        <p className="text-gray-400">Failed to load fee data</p>
                    </div>
                )}
            </div>
        </div>
    );
};
