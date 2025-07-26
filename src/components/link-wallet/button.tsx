import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useSelector, useDispatch } from "react-redux";
import { POST } from "@/config/axios/requests";
import { Loader2, Check, Copy, Wallet, LogOut, X, AlertCircle } from "lucide-react";
import { setUser } from "@/app/Redux/Features/user/userSlice"; 
import { toast } from "react-toastify"; 
import { clearError } from "@/app/Redux/Features/error/error";

type ProcessState = 'idle' | 'connecting' | 'linking';

export default function WalletManager() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const { setVisible, visible } = useWalletModal();
  const user = useSelector((state: any) => state.user);
  const dispatch = useDispatch();

  const [processState, setProcessState] = useState<ProcessState>('idle');
  const error = useSelector((state: any) => state.error);

  const isLoading = processState !== 'idle';
  const isWalletReady = connected && publicKey && signMessage;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Address copied!");
    } catch (err) {
      toast.error("Failed to copy address.");
      console.error("Copy to clipboard failed:", err);
    }
  };

  const truncateAddress = (address: string, startChars = 4, endChars = 4) => {
    if (!address) return "";
    return `${address.slice(0, startChars)}...${address.slice(address.length - endChars)}`;
  };

  const resetState = () => {
    setProcessState('idle');
  };

  const handleDisconnect = async () => {
    try {
      resetState();
      await disconnect();
      await POST("/unlinkWallet", { githubId: user.githubId }, { "Content-Type": "application/json" });
      dispatch(setUser({ ...user, walletAddress: "" }));
      toast.success("Wallet disconnected.");
    } catch (err) {
      console.error("Disconnect error:", err);
      toast.error("Failed to disconnect wallet.");
    }
  };

  const linkWallet = async () => {
    if (!isWalletReady) {
      return;
    }

    setProcessState('linking');
    try {
      const { response: nonceResponse, error: nonceError } = await POST(
        "/linkWallet",
        { publicKey: publicKey.toBase58(), githubId: user.githubId },
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
          publicKey: publicKey.toBase58(),
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

      dispatch(setUser({ ...user, walletAddress: publicKey.toBase58() }));
      toast.success("Wallet linked successfully!");
      resetState();

    } catch (err: any) {
      const errorMessage = "An unknown error occurred.";
      toast.error(errorMessage);
      if (connected) await disconnect();
      resetState();
    }
  };

  const handleConnectAndLink = async () => {
    if (isLoading) return;

    if (isWalletReady) {
      await linkWallet();
      return;
    }

    setProcessState('connecting');
    setVisible(true);
  };

  useEffect(() => {
    if (processState !== 'connecting') {
      return;
    }

    if (isWalletReady) {
      linkWallet();
      return;
    }

    if (!visible) {
      const timer = setTimeout(() => {
        if (processState === 'connecting' && !isWalletReady) {
          toast.error("Wallet connection cancelled.");
          resetState();
        }
      }, 10000);

      return () => clearTimeout(timer);
    }
  }, [processState, isWalletReady, visible, linkWallet, resetState]);

  if (user === undefined) {
    return <div className="p-2"><Loader2 className="h-4 w-4 animate-spin text-gray-400" /></div>;
  }

  if (user?.walletAddress) {
    return (
      <div className="group relative overflow-hidden rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 via-emerald-500/5 to-teal-500/5 backdrop-blur-sm transition-all duration-300 hover:border-green-400/30 hover:shadow-lg hover:shadow-green-500/10">
        <div className="relative flex items-center gap-4 justify-between p-2">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-green-500/20 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:animate-ping" />
            </div>
            <div className="flex flex-col">
              <code className="text-sm font-mono text-green-300 transition-colors duration-300 group-hover:text-green-200">
                {truncateAddress(user.walletAddress)}
              </code>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => copyToClipboard(user.walletAddress)}
              className="group/copy relative flex h-8 w-8 items-center justify-center rounded-lg border border-green-500/20 bg-green-500/10 text-green-400 transition-all duration-200 hover:border-green-400/30 hover:bg-green-500/20 hover:text-green-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <Copy className="h-3 w-3 transition-transform duration-200 group-hover/copy:scale-110" />
            </button>
            <button
              onClick={handleDisconnect}
              className="group/disconnect relative flex h-8 w-8 items-center justify-center rounded-lg border border-green-500/20 bg-green-500/10 text-green-400 transition-all duration-200 hover:border-red-400/30 hover:bg-red-500/20 hover:text-red-400 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              <LogOut className="h-3 w-3 transition-transform duration-200 group-hover/disconnect:scale-110" />
            </button>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start justify-between space-x-3">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-red-300">Connection Failed</span>
            <span className="text-xs text-red-400/70">{error}</span>
          </div>
        </div>
        <button
          onClick={() => {
            dispatch(clearError())
          }}
          className="flex-shrink-0 rounded-lg p-1 text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          title="Dismiss error"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center">
      <button
        onClick={handleConnectAndLink}
        disabled={isLoading}
        className="group relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-600/10 via-orange-600/10 to-yellow-600/10 p-4 backdrop-blur-sm transition-all duration-300 hover:border-amber-400/50 hover:from-amber-600/20 hover:via-orange-600/20 hover:to-yellow-600/20 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:animate-pulse" />
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        <div className="relative flex items-center justify-center space-x-3">
          <div className="relative">
            <Wallet className="h-5 w-5 text-amber-400 transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute inset-0 h-5 w-5 rounded-full bg-amber-400/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:animate-ping" />
          </div>
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-amber-300 transition-colors duration-300 group-hover:text-amber-200">
              Connect & Link Wallet
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
