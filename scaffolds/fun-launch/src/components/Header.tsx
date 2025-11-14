import { useUnifiedWalletContext, useWallet } from '@jup-ag/wallet-adapter';
import Link from 'next/link';
import { Button } from './ui/button';
import { CreatePoolButton } from './CreatePoolButton';
import { useEffect, useMemo, useState, useRef } from 'react';
import { shortenAddress } from '@/lib/utils';
import { useRouter } from 'next/router';

export const Header = () => {
  const { setShowModal } = useUnifiedWalletContext();

  const { disconnect, publicKey } = useWallet();
  const address = useMemo(() => publicKey?.toBase58(), [publicKey]);
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch admin address on mount
  useEffect(() => {
    const fetchAdminAddress = async () => {
      try {
        const response = await fetch('/api/admin/get-admin-address');
        if (response.ok) {
          const data = await response.json();
          setAdminAddress(data.adminAddress);
        }
      } catch (error) {
        console.error('Failed to fetch admin address:', error);
      }
    };
    fetchAdminAddress();
  }, []);

  // Check if connected wallet is admin
  useEffect(() => {
    if (address && adminAddress) {
      setIsAdmin(address === adminAddress);
    } else {
      setIsAdmin(false);
    }
  }, [address, adminAddress]);

  // Fetch SOL balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!address) {
        setSolBalance(null);
        return;
      }

      try {
        const response = await fetch('/api/user/get-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        });

        if (response.ok) {
          const data = await response.json();
          setSolBalance(data.balance);
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
      }
    };

    fetchBalance();
  }, [address]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnectWallet = () => {
    // In a real implementation, this would connect to a Solana wallet
    setShowModal(true);
  };

  const handleDisconnect = () => {
    disconnect();
    setShowDropdown(false);
  };

  const handleProfileClick = () => {
    if (address) {
      router.push(`/users/${address}`);
      setShowDropdown(false);
    }
  };

  return (
    <header className="w-full px-6 py-5 flex items-center justify-between border-b border-white/5 bg-black">
      {/* Logo Section */}
      <Link href="/" className="flex items-center gap-3 group">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl blur-sm opacity-50 group-hover:opacity-75 transition-opacity" />
          <div className="relative w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-all duration-300">
            <span className="text-white font-black text-xl md:text-2xl">T</span>
          </div>
        </div>
        <div className="flex flex-col">
          <span className="whitespace-nowrap text-xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
            TrenchFun
          </span>
          <span className="text-xs text-gray-500 font-medium -mt-1">FAIR LAUNCH</span>
        </div>
      </Link>

      {/* Navigation and Actions */}
      <div className="flex items-center gap-3">
        {isAdmin && (
          <Link href="/admin">
            <Button className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white border-0 shadow-lg shadow-orange-500/20">
              Admin Dashboard
            </Button>
          </Link>
        )}
        <CreatePoolButton />
        {address ? (
          <div className="relative" ref={dropdownRef}>
            <Button
              onClick={() => setShowDropdown(!showDropdown)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all word-break-none flex items-center"
            >
              {shortenAddress(address)}
              <svg
                className={`w-4 h-4 ml-2 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                {/* Balance Section */}
                <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">SOL Balance</span>
                    <div className="flex items-center gap-1">
                      <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                      </svg>
                      <span className="text-white font-semibold">
                        {solBalance !== null ? solBalance.toFixed(4) : '...'} SOL
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={handleProfileClick}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-medium group-hover:text-purple-400 transition-colors">Profile</div>
                      <div className="text-xs text-gray-500">View your tokens</div>
                    </div>
                    <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                      <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-red-400 font-medium">Disconnect</div>
                      <div className="text-xs text-gray-500">Sign out wallet</div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Button
            onClick={() => {
              handleConnectWallet();
            }}
            className="relative group overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 shadow-lg shadow-purple-500/20"
          >
            <span className="relative z-10 hidden md:block">Connect Wallet</span>
            <span className="relative z-10 block md:hidden">Connect</span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 transition-opacity" />
          </Button>
        )}
      </div>
    </header>
  );
};

export default Header;
