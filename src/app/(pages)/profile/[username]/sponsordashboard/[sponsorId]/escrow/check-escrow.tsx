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
  AlertCircle,
  Clock
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
  time: string;
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
  onRefetchIssues?: () => void; // Optional callback to refetch issues on state change
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

export default function BountyLockedDialog({ issue, onRefetchIssues }: BountyLockedDialogProps) {
  const wallet = useWallet();
  const {connection} = useConnection();
  const user = useSelector((state: any) => state.user);
  const [winningSubmission, setWinningSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const selectedRepo = useSelector((state:any)=>state.selectedRepo);

  const fetchWinningSubmission = async () => {
    setLoading(true);
    try {
        const response = await GET(`/getWinnerSubmission?issueNumber=${issue.number.toString()}&repoName=${selectedRepo.full_name}`);
   
        
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



  // Handle dialog open state change
  const handleOpenChange = (isOpen: boolean) => {
    setDialogOpen(isOpen);
    if (isOpen) {
      fetchWinningSubmission();
    }
  };
  
  // Modified onCancelBounty to update status to 8 (Request to cancel)
  const onCancelBounty = async () => {
    if (!winningSubmission?.bounty?.id) {
      toast.error("Bounty ID not found");
      return;
    }

    try {
      // Update bounty status to 8 (Request to cancel)
      const response = await POST("/cancelBounty", {
        bountyId: winningSubmission.bounty.id,
        status: 8, // Request to cancel
        transactionSuccess: false,
        githubId: user.githubId // Use the current user's githubId
      },{
        Authorization: `Bearer ${user.accessToken}`
      });

      if (response && response.response?.status === 200) {
        toast.success("Cancellation request submitted successfully. An admin will review and process your request.");
        // Close the dialog and trigger repo issues refetch
        setDialogOpen(false);
        onRefetchIssues?.();
      } else {
        toast.error("Failed to submit cancellation request");
      }
    } catch (error) {
      console.error("Error submitting cancellation request:", error);
      toast.error("Failed to submit cancellation request. Please try again.");
    }
  };



  if (loading) {
    return (
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all">
            <Lock className="w-4 h-4" />
            View Locked Submission
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] border border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-700 border-t-emerald-500 mx-auto"></div>
              <p className="text-slate-400">Loading...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!winningSubmission) {
    return (
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all">
            <Lock className="w-4 h-4" />
            View Locked Submission
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] border border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
              <p className="text-slate-400">No winning submission found</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all">
          <Lock className="w-4 h-4" />
          View Locked Submission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] border border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-700/50">
            <Lock className="w-5 h-5 text-yellow-400" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">Locked Bounty</h2>
              <p className="text-slate-400 text-sm">
                Review the winning submission
              </p>
            </div>
          </div>

          {/* Bounty Overview */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                <span className="text-xl font-bold text-yellow-400">
                  {winningSubmission.bounty.price} <span className="text-sm text-gray-50 px-2 py-1 rounded">USDC</span>
                </span>
              </div>
              <div className="text-right text-sm text-slate-400">
                <div>Created {formatDate(winningSubmission.bounty.createdAt)}</div>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 text-orange-400" />
                  <span className="text-orange-400 font-medium">
                    Deadline: {formatDate(winningSubmission.bounty.time)}
                  </span>
                </div>
                {winningSubmission.bounty.skills && winningSubmission.bounty.skills.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap justify-end">
                    {winningSubmission.bounty.skills.slice(0, 3).map((skill: string, index: number) => (
                      <span key={index} className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Deadline Warning */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-400">
                ⚠️ Deadline Reminder
              </span>
            </div>
            <p className="text-xs text-orange-300 mt-1">
              The contributor must push their first commit before the deadline. If no commits are made by {formatDate(winningSubmission.bounty.time)}, you can close this assignment and reassign the bounty.
            </p>
          </div>

          {/* Submission Details */}
          <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
            <div className="space-y-6">
              {/* Submission Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-300" />
                  <span className="font-medium text-slate-100">Winning Submission</span>
                </div>
                <span className="text-sm text-slate-400">
                  {formatDate(winningSubmission.createdAt)}
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Wallet Address */}
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <Wallet className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Wallet Address</p>
                    <code className="text-xs text-slate-300 font-mono">
                      {formatWalletAddress(winningSubmission.walletAddress || "")}
                    </code>
                  </div>
                </div>

                {/* Pull Request */}
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <ExternalLink className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Pull Request</p>
                    {winningSubmission.links && winningSubmission.links.length > 0 ? (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-slate-800 border-slate-600 hover:border-blue-500 text-blue-400"
                        onClick={() => window.open(winningSubmission.links[0], "_blank")}
                      >
                        View PR #{winningSubmission.githubPRNumber || 'N/A'}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-500">No PR available</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}

            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t border-slate-700/50">
            <Button
              onClick={onCancelBounty}
              disabled={loading || !wallet.connected}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                  Cancelling...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Cancel
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}