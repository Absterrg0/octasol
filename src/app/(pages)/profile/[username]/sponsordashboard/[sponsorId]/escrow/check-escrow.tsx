"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { 
  ExternalLink, 
  Lock, 
  DollarSign, 
  User, 
  Calendar,
  CheckCircle,
  Wallet,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { toast } from "react-toastify";
import { GET } from "@/config/axios/requests"; // Assuming GET is a helper for fetch
import { useSelector } from "react-redux";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { OctasolContract } from "../../../../../../../../contract/types/octasol_contract";
import idl from "../../../../../../../../contract/idl/octasol_contract.json";
import { createHash } from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { POST } from "@/config/axios/requests";
// Define types for better type safety
type Bounty = {
  id: number;
  bountyname: string;
  price: number;
  skills: string[];
  createdAt: string;
};

type Submission = {
  id: number;
  githubId: number;
  githubPRNumber?: number;
  links: string[];
  notes?: string;
  status: number;
  walletAddress?: string;
  createdAt: string;
  bounty: Bounty;
};

type BountyLockedDialogProps = {
  issue: any; // The new prop to pass the issue object
};

// Helper function for status information
const getStatusInfo = (status: number) => {
  switch (status) {
    case 2:
      return { 
        label: "Winner", 
        icon: CheckCircle, 
        variant: "default" as const,
        description: "Selected as winner",
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      };
    case 3:
        return { 
          label: "Rejected", 
          icon: XCircle, 
          variant: "destructive" as const,
          description: "Not selected",
          color: "text-red-400 bg-red-500/10 border-red-500/20"
        };
    default:
      return { 
        label: "Locked", 
        icon: Lock, 
        variant: "default" as const,
        description: "Submission is locked in",
        color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
      };
  }
};

// Helper function to format wallet address
const formatWalletAddress = (address: string) => {
  if (!address) return "No wallet address";
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
};


// Helper function to format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function BountyLockedDialog({ issue }: BountyLockedDialogProps) {
  const wallet = useWallet();
  const {connection} = useConnection();
  const [winningSubmission, setWinningSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const selectedRepo = useSelector((state:any)=>state.selectedRepo);

  const fetchWinningSubmission = async () => {
    setLoading(true);
    try {
        const response = await GET(`/getWinnerSubmission?issueNumber=${issue.number.toString()}&repoName=${selectedRepo.full_name}`);
        console.log(response);
        
        // Check for success and set the winning submission data
        if (response) {
            setWinningSubmission(response.winningSubmission); // The API returns the submission object directly
        } else {
            setWinningSubmission(null);
            toast.error(response?.msg || "Failed to fetch winning submission.");
        }
    } catch (error) {
        console.error("Error fetching winning submission:", error);
        setWinningSubmission(null);
        toast.error("Failed to fetch winning submission.");
    } finally {
        setLoading(false);
    }
};



function generateBountyKeypair(bountyId: string): Keypair {
  const seedString = `octasol_bounty_${bountyId}`;
  const hash = createHash('sha256').update(seedString).digest();
  const keypairSeed = hash.slice(0, 32);
  return Keypair.fromSeed(keypairSeed);
}

  // Handle dialog open state change
  const handleOpenChange = (isOpen: boolean) => {
    setDialogOpen(isOpen);
    fetchWinningSubmission();
  };
  
  // Placeholder for onCancelBounty and isCancelling
  const onCancelBounty = async () => {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!winningSubmission?.bounty?.id) {
      toast.error("Bounty ID not found");
      return;
    }

    let transactionSuccess = false;

    try {
      const bountyId = winningSubmission.bounty.id;

      // Step 1: Setup blockchain transaction
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };

      const provider = new AnchorProvider(connection, anchorWallet, {
        preflightCommitment: "confirmed",
        commitment: "confirmed"
      });
      const program = new Program(idl as any, provider);

      const USDCMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
      const bountyAccountKp = generateBountyKeypair(bountyId.toString());
      const maintainerTokenAccount = getAssociatedTokenAddressSync(USDCMint, wallet.publicKey, false, TOKEN_PROGRAM_ID);
      const [escrowAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_auth"), bountyAccountKp.publicKey.toBuffer()],
        program.programId
      );
      const escrowTokenAccount = await getAssociatedTokenAddress(
        USDCMint,
        escrowAuthorityPda,
        true
      );

      // Step 2: Execute blockchain transaction
      const txHash = await program.methods.cancelBounty().accounts({
        maintainer: wallet.publicKey,
        bounty: bountyAccountKp.publicKey,
        escrowAuthority: escrowAuthorityPda,
        escrowTokenAccount: escrowTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        maintainerTokenAccount: maintainerTokenAccount,
      }).rpc();

      console.log("Transaction successful:", txHash);
      transactionSuccess = true;
      
      toast.success("Bounty cancelled successfully on blockchain!");

    } catch (error) {
      console.error("Blockchain transaction failed:", error);
      
      let errorMessage = "Failed to cancel bounty on blockchain.";
      if (error instanceof Error) {
        if (error.message.includes("User rejected")) {
          errorMessage = "Transaction was rejected in your wallet.";
        } else if (error.message.includes("insufficient funds")) {
          errorMessage = "You have insufficient SOL for the transaction fees.";
        } else if (error.message.includes("Simulation failed")) {
          errorMessage = "Transaction simulation failed. Please try again.";
        } else {
          errorMessage = `Blockchain error: ${error.message}`;
        }
      }
      
      toast.error(errorMessage);
      transactionSuccess = false;
    }

    // Step 3: Update database based on transaction result
    try {
      const response = await POST("/cancelBounty", {
        bountyId: winningSubmission.bounty.id,
        status: transactionSuccess ? 6 : 7, // 6 = successfully cancelled, 7 = failed to cancel
        transactionSuccess
      });

      if (response && response.response?.status===200) {
        if (transactionSuccess) {
          toast.success("Bounty status updated to cancelled in database!");
          // Optionally close the dialog or refresh data
          handleOpenChange(false);
        } else {
          toast.info("Bounty marked as failed cancellation in database.");
        }
      } else {
        toast.error("Failed to update bounty status in database.");
      }
    } catch (dbError) {
      console.error("Database update failed:", dbError);
      toast.error("Failed to update bounty status in database.");
    } 
  };



  if (loading) {
    return (
      <Dialog onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all">
            <Lock className="w-4 h-4" />
            View Locked Submission
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl w-full max-h-[95vh] p-0 border-2 border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
          <div className="flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-emerald-500 mx-auto"></div>
              <p className="text-slate-400 font-medium">Loading winning submission...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!winningSubmission) {
    return (
      <Dialog onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all">
            <Lock className="w-4 h-4" />
            View Locked Submission
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl w-full max-h-[95vh] p-0 border-2 border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
          <div className="text-center py-16 space-y-6">
            <div className="p-6 bg-slate-800/50 border-2 border-slate-700 rounded-2xl w-fit mx-auto">
              <AlertCircle className="w-12 h-12 text-slate-500" />
            </div>
            <div>
              <h3 className="font-bold text-xl text-slate-200 mb-2">No winning submission found</h3>
              <p className="text-slate-400">
                This bounty is likely still open or has not had a winner selected.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const statusInfo = getStatusInfo(winningSubmission.status);
  const StatusIcon = statusInfo.icon;

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all">
          <Lock className="w-4 h-4" />
          View Locked Submission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-full max-h-[95vh] p-0 border-2 border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b-2 border-slate-700 bg-black">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-800 border-2 border-slate-600 rounded-xl">
                  <Lock className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-100">Locked Bounty Details</h2>
                  <p className="text-lg text-slate-400 mt-2">
                    This bounty has a winning submission locked in. You can review the details or cancel the bounty if needed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bounty Overview */}
        <div className="mx-8 mt-6 bg-gradient-to-r from-yellow-500/5 to-amber-500/5 border-2 border-yellow-500/20 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-yellow-500/10 border-2 border-yellow-500/20 rounded-xl">
                <DollarSign className="w-8 h-8 text-yellow-400" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold text-yellow-400">
                    ${winningSubmission.bounty.price}
                  </span>
                  <Badge className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-xl">
                    USDC
                  </Badge>
                </div>
                <p className="text-yellow-300/80 font-medium">Total Bounty Amount</p>
              </div>
            </div>
            <div className="text-right space-y-3">
              <div className="flex items-center gap-2 text-sm bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">Created {formatDate(winningSubmission.bounty.createdAt)}</span>
              </div>
              {winningSubmission.bounty.skills && winningSubmission.bounty.skills.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {winningSubmission.bounty.skills.slice(0, 3).map((skill: string, index: number) => (
                    <Badge key={index} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-2 py-1 rounded-lg">
                      {skill}
                    </Badge>
                  ))}
                  {winningSubmission.bounty.skills.length > 3 && (
                    <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-2 py-1 rounded-lg">
                      +{winningSubmission.bounty.skills.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="mx-8 my-6">
          <div className="h-[2px] bg-slate-700 rounded-full"></div>
        </div>

        {/* Single Locked Submission */}
        <div className="mx-8 mb-8">
          <div className="bg-black border-2 border-yellow-500/30 hover:border-yellow-500/50 rounded-2xl transition-all shadow-lg overflow-hidden border-l-4 border-l-yellow-400">
            <div className="p-6">
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800 border-2 border-slate-600 rounded-xl">
                      <User className="w-5 h-5 text-slate-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg text-slate-100">Winning Submission</span>
                        <Badge className={`gap-2 px-3 py-1 rounded-xl border-2 ${statusInfo.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-slate-400">
                        {statusInfo.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Calendar className="w-4 h-4" />
                      {formatDate(winningSubmission.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Wallet Info */}
                  <div className="flex items-center gap-4 p-4 bg-slate-800/30 border border-slate-600 rounded-xl">
                    <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <Wallet className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200 mb-1">Wallet Address</p>
                      <code className="text-sm text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-700">
                        {formatWalletAddress(winningSubmission.walletAddress || "")}
                      </code>
                    </div>
                  </div>

                  {/* PR Link */}
                  <div className="flex items-center gap-4 p-4 bg-slate-800/30 border border-slate-600 rounded-xl">
                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <ExternalLink className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-200 mb-1">Pull Request</p>
                      {winningSubmission.links && winningSubmission.links.length > 0 ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-auto p-2 text-xs bg-slate-900 border border-slate-600 hover:border-blue-500 hover:bg-slate-800 text-blue-400 rounded-lg transition-all"
                          onClick={() => window.open(winningSubmission.links[0], "_blank")}
                        >
                          View PR #{winningSubmission.githubPRNumber || 'N/A'}
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-slate-700">No PR link</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {winningSubmission.notes && (
                  <div className="p-4 bg-slate-800/20 border border-slate-600 rounded-xl">
                    <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Notes
                    </p>
                    <p className="text-sm text-slate-400 leading-relaxed">{winningSubmission.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="mx-8">
          <div className="h-[2px] bg-slate-700 rounded-full"></div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 px-8 py-6 bg-black">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={onCancelBounty}
              disabled={loading || !wallet.connected}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-2 border-red-500 hover:border-red-400 rounded-xl px-6 py-3 font-semibold transition-all shadow-lg gap-2 h-12"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Cancel Bounty
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}