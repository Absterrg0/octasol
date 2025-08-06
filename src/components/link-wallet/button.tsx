import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSelector, useDispatch } from "react-redux";
import { POST } from "@/config/axios/requests";
import { Loader2, Check, Copy, Wallet, LogOut, X, AlertCircle, RefreshCw, Shield, ChevronDown } from "lucide-react";
import { setUser } from "@/app/Redux/Features/user/userSlice"; 
import { toast } from "react-toastify"; 
import { clearError } from "@/app/Redux/Features/error/error";

type ProcessState = 'idle' | 'connecting' | 'linking' | 'unlinking';
type WalletState = 'no-wallet' | 'wallet-linked-disconnected' | 'wallet-connected-correct' | 'wallet-connected-wrong';

export default function WalletManager() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible, visible } = useWalletModal();
  const user = useSelector((state: any) => state.user);
  const dispatch = useDispatch();
  const [error,setError] = useState<string | null>(null);

  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [showDropdown, setShowDropdown] = useState(false);

  const isLoading = processState !== 'idle';
  const isWalletReady = connected && publicKey && signMessage;
  const linkedWalletAddress = user?.walletAddress;
  const connectedWalletAddress = publicKey?.toBase58();
  
  // Determine wallet state with clear logic
  const getWalletState = (): WalletState => {
    if (!linkedWalletAddress) return 'no-wallet';
    if (!connected || !connectedWalletAddress) return 'wallet-linked-disconnected';
    if (connectedWalletAddress === linkedWalletAddress) return 'wallet-connected-correct';
    return 'wallet-connected-wrong';
  };

  const walletState = getWalletState();

  const copyToClipboard = async (text: string | undefined) => {
    if (!text) {
      toast.error("No address to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Address copied!");
    } catch (err) {
      toast.error("Failed to copy address.");
      console.error("Copy to clipboard failed:", err);
    }
  };

  const truncateAddress = (address: string | undefined, startChars = 4, endChars = 4) => {
    if (!address) return "";
    return `${address.slice(0, startChars)}...${address.slice(address.length - endChars)}`;
  };

  const resetState = () => {
    setProcessState('idle');
  };

  const handleConnectWallet = () => {
    if (isLoading) return;
    setProcessState('connecting');
    setVisible(true);
    setShowDropdown(false);
  };

  const handleDisconnectAndUnlink = async () => {
    if (isLoading || !user?.githubId) return;
    
    setProcessState('unlinking');
    setShowDropdown(false);
    try {
      if (connected) await disconnect();
      await POST("/unlinkWallet", { githubId: user.githubId }, { "Content-Type": "application/json" });
      dispatch(setUser({ ...user, walletAddress: "" }));
      toast.success("Wallet disconnected and unlinked successfully.");
    } catch (err) {
      console.error("Unlink error:", err);
      toast.error("Failed to unlink wallet. Please try again.");
    } finally {
      resetState();
    }
  };

  const handleDisconnectWallet = async () => {
    if (isLoading) return;
    
    try {
      await disconnect();
      toast.success("Wallet disconnected.");
    } catch (err) {
      console.error("Disconnect error:", err);
      toast.error("Failed to disconnect wallet.");
    }
    setShowDropdown(false);
  };

  const linkCurrentWallet = async () => {
    if (!isWalletReady || !publicKey) return;

    setProcessState('linking');
    try {
      const publicKeyString = publicKey.toBase58();
      const { response: nonceResponse, error: nonceError } = await POST(
        "/linkWallet",
        { publicKey: publicKeyString, githubId: user.githubId },
        { "Content-Type": "application/json" }
      );
      
      if (nonceError || !nonceResponse?.data?.message) {
        throw new Error("Failed to get validation message from server.");
      }

      const { message, timestamp } = nonceResponse.data;
      const signature = await signMessage(new TextEncoder().encode(message));

      const { error: verificationError } = await POST(
        "/linkWallet",
        {
          publicKey: publicKeyString,
          signature: Array.from(signature),
          githubId: user.githubId,
          timestamp: timestamp,
        },
        { "Content-Type": "application/json" }
      );
      
      if (verificationError) {
        const errorMsg = (verificationError as any)?.response?.data?.error || "Signature verification failed.";
        throw new Error(errorMsg);
      }

      dispatch(setUser({ ...user, walletAddress: publicKeyString }));
      toast.success("Wallet linked successfully!");
    } catch (err: any) {
      console.error("Link wallet error:", err);
      toast.error(err.message || "Failed to link wallet. Please try again.");
      
      if (connected) await disconnect();
    } finally {
      resetState();
    }
  };

  // Handle wallet modal visibility and connection state
  useEffect(() => {
    if (processState !== 'connecting') return;

    if (isWalletReady) {
      linkCurrentWallet();
      return;
    }

    if (!visible) {
      const timer = setTimeout(() => {
        if (processState === 'connecting' && !isWalletReady) {
          toast.info("Wallet connection cancelled.");
          resetState();
        }
      }, 20000);

      return () => clearTimeout(timer);
    }
  }, [processState, isWalletReady, visible]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDropdown]);

  // Show loading if user data isn't ready
  if (user === undefined) {
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error state - compact red indicator
  if (error) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
        >
          <AlertCircle className="h-4 w-4" />
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-10 w-64 rounded-lg border border-red-500/20 bg-gray-900/95 p-3 shadow-xl backdrop-blur-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <AlertCircle className="h-4 w-4 text-red-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-300">Connection Error</p>
                  <p className="text-xs text-red-400/80">{error}</p>
                </div>
              </div>
              <button
                onClick={() => dispatch(clearError())}
                className="text-red-400/70 hover:text-red-300"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STATE 1: Perfect - Connected and linked correctly
  if (walletState === 'wallet-connected-correct') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-green-400 hover:bg-green-500/20 transition-colors"
        >
          <Check className="h-3 w-3" />
          <span className="text-xs font-mono">{truncateAddress(linkedWalletAddress)}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 top-10 w-56 rounded-lg border border-green-500/20 bg-gray-900/95 p-3 shadow-xl backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-3">
              <div className="rounded-full bg-green-500/20 p-1">
                <Shield className="h-3 w-3 text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-green-300">Wallet Connected</p>
                <code className="text-xs font-mono text-green-400/80">{truncateAddress(linkedWalletAddress, 6, 6)}</code>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => copyToClipboard(linkedWalletAddress)}
                className="flex-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-400 hover:bg-green-500/20"
              >
                Copy
              </button>
              <button
                onClick={handleDisconnectAndUnlink}
                disabled={isLoading}
                className="flex-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-400 hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
              >
                {processState === 'unlinking' ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : 'Unlink'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STATE 2: Wallet linked but disconnected
  if (walletState === 'wallet-linked-disconnected') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <AlertCircle className="h-3 w-3" />
          <span className="text-xs font-mono">{truncateAddress(linkedWalletAddress)}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 top-10 w-56 rounded-lg border border-amber-500/20 bg-gray-900/95 p-3 shadow-xl backdrop-blur-sm">
            <div className="flex items-center space-x-2 mb-3">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <div>
                <p className="text-xs font-medium text-amber-300">Wallet Disconnected</p>
                <code className="text-xs font-mono text-amber-400/80">{truncateAddress(linkedWalletAddress, 6, 6)}</code>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleConnectWallet}
                disabled={isLoading}
                className="flex-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
              >
                {processState === 'connecting' ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : 'Reconnect'}
              </button>
              <button
                onClick={handleDisconnectAndUnlink}
                disabled={isLoading}
                className="flex-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-400 hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
              >
                {processState === 'unlinking' ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : 'Unlink'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STATE 3: Wrong wallet connected - Compact red warning
  if (walletState === 'wallet-connected-wrong') {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-1 rounded-lg border border-red-500/40 bg-red-500/15 px-2 py-1.5 text-red-400 hover:bg-red-500/20 transition-colors animate-pulse"
        >
          <AlertCircle className="h-3 w-3" />
          <span className="text-xs">Wrong Wallet</span>
          <ChevronDown className="h-3 w-3" />
        </button>
        
        {showDropdown && (
          <div className="absolute right-0 top-10 w-64 rounded-lg border border-red-500/30 bg-gray-900/95 p-3 shadow-xl backdrop-blur-sm">
            <div className="mb-3">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <span className="text-xs font-medium text-red-300">Wrong Wallet Connected</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-red-400/70">Expected:</span>
                  <code className="text-red-300">{truncateAddress(linkedWalletAddress, 4, 4)}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-red-400/70">Connected:</span>
                  <code className="text-red-200">{truncateAddress(connectedWalletAddress, 4, 4)}</code>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleDisconnectWallet}
                className="flex-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // STATE 4: No wallet linked - Compact connect button
  return (
    <button
      onClick={handleConnectWallet}
      disabled={isLoading}
      className="flex items-center space-x-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
    >
      {processState === 'connecting' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : processState === 'linking' ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Wallet className="h-3 w-3" />
      )}
      <span className="text-xs font-medium">
        {processState === 'connecting' ? 'Connecting...' 
         : processState === 'linking' ? 'Linking...' 
         : 'Connect'}
      </span>
    </button>
  );
}