"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/constants";
import { GET, POST } from "@/config/axios/requests";
import { toast } from "react-toastify";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
// Tabs removed for simplified single-view page
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  User,
  Calendar,
  Wallet,
  ExternalLink,
} from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { OctasolContract } from "../../../../../contract/types/octasol_contract";
import idl from "../../../../../contract/idl/octasol_contract.json";
import { createHash } from "crypto";
import { Keypair, PublicKey, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { SystemProgram } from "@solana/web3.js";
import { generateBountyKeypair } from "@/lib/utils";

interface Bounty {
  id: number;
  bountyname: string;
  price: number;
  repoName?: string;
  issueNumber?: number;
  status: number;
  escrowPda?: string;
  createdAt: string;
  sponsor: {
    name: string;
    image?: string;
    githubId: string;
  };
  submissions: Array<{
    id: number;
    status: number;
    githubPRNumber?: number;
    walletAddress?: string;
    githubId: string;
    user: {
      username: string;
    };
  }>;
}

export default function AdminBountiesPage() {
  const router = useRouter();
  const user = useSelector((state: any) => state.user);
  const wallet = useWallet();
  const { connection } = useConnection();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBounty, setSelectedBounty] = useState<Bounty | null>(null);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cancellingBounty, setCancellingBounty] = useState<number | null>(null);
  const [payingOutSubmission, setPayingOutSubmission] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("cancellation-requests");
  const [cancellationRequestCount, setCancellationRequestCount] = useState<number>(0);
  const [customWalletAddress, setCustomWalletAddress] = useState<string>("");
  const [showCustomWalletInput, setShowCustomWalletInput] = useState<boolean>(false);

  // Client-side admin guard: navigate back if user is not admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.login) {
        const adminStatus = await isAdmin(user.login);
        if (!adminStatus) {
          router.back();
        }
      }
    };
    
    checkAdminStatus();
  }, [user, router]);


  const fetchBounties = async () => {
    try {
      setLoading(true);
      const response = await GET(`/admin/bounties?filter=cancellation-requests`, {
        Authorization: `Bearer ${user.accessToken}`,
      });
      
      if (response.success) {
        setBounties(response.data);
      } else {
        toast.error("Failed to fetch bounties");
      }
    } catch (error) {
      console.error("Error fetching bounties:", error);
      toast.error("Failed to fetch bounties");
    } finally {
      setLoading(false);
    }
  };

  const fetchCancellationRequestCount = async () => {
    try {
      const response = await GET("/admin/bounties?filter=cancellation-requests", {
        Authorization: `Bearer ${user.accessToken}`,
      });
      
      if (response.success) {
        setCancellationRequestCount(response.count);
      }
    } catch (error) {
      console.error("Error fetching cancellation request count:", error);
    }
  };

  useEffect(() => {
    if (user?.accessToken) {
      fetchBounties();
      fetchCancellationRequestCount();
    }
  }, [user]);

  const getStatusInfo = (status: number) => {
    switch (status) {
      case 0:
        return {
          label: "Draft",
          icon: Clock,
          color: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
        };
      case 1:
        return {
          label: "In Review",
          icon: AlertCircle,
          color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
        };
      case 2:
        return {
          label: "Active",
          icon: CheckCircle,
          color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
        };
      case 3:
        return {
          label: "Completed",
          icon: CheckCircle,
          color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
        };
      case 4:
        return {
          label: "In Review by Sponsor",
          icon: AlertCircle,
          color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
        };
      case 5:
        return {
          label: "Rejected by Admin",
          icon: XCircle,
          color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        };
      case 6:
        return {
          label: "Rejected by Sponsor",
          icon: XCircle,
          color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        };
      case 7:
        return {
          label: "Cancelled",
          icon: XCircle,
          color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        };
      case 8:
        return {
          label: "Request to Cancel",
          icon: AlertCircle,
          color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
        };
      default:
        return {
          label: "Unknown",
          icon: AlertCircle,
          color: "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300",
        };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return "No wallet address";
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };



  const handleCancelBounty = async (bounty: Bounty) => {
    setCancellingBounty(bounty.id);

    try {
      const bountyId = bounty.id;

      // Call server to handle the cancel bounty transaction
      const response = await POST("/cancelBounty", {
        bountyId: bountyId,
        status: 7,
        githubId: user.githubId,
      }, {
        Authorization: `Bearer ${user.accessToken}`,
      });

      if (response && response.response?.status === 200) {
        toast.success("Bounty cancelled successfully!");
        fetchBounties(); // Refresh the list
      } else {
        toast.error("Failed to cancel bounty.");
      }

    } catch (error) {
      console.error("Error cancelling bounty:", error);
      toast.error("Failed to cancel bounty. Please try again.");
    } finally {
      setCancellingBounty(null);
    }
  };

  const handlePayOut = async (submission: any) => {
    if (!submission.walletAddress) {
      toast.error("Submission has no wallet address");
      return;
    }

    setPayingOutSubmission(submission.id);

    try {
      const bountyId = selectedBounty!.id;

      // Call server to handle the complete bounty transaction
      const response = await POST("/releasePayment", {
        bountyId: bountyId,
        submissionId: submission.id,
        isAdminPayout: true
      }, {
        Authorization: `Bearer ${user.accessToken}`,
      });

      if (response && response.response?.status === 200) {
        toast.success("Payment released successfully!");
        setPayoutDialogOpen(false);
        setSelectedBounty(null);
        fetchBounties(); // Refresh the list
      } else {
        toast.error("Failed to release payment.");
      }

    } catch (error) {
      console.error("Error releasing payment:", error);
      toast.error("Failed to release payment. Please try again.");
    } finally {
      setPayingOutSubmission(null);
    }
  };

  const handleCustomPayOutForSubmission = async (submission: any) => {
    if (!submission.walletAddress) {
      toast.error("Submission has no wallet address");
      return;
    }

    setPayingOutSubmission(submission.id);

    try {
      const bountyId = selectedBounty!.id;

      const response = await POST("/releasePayment", {
        bountyId: bountyId,
        customWalletAddress: submission.walletAddress,
        isCustomPayout: true
      }, {
        Authorization: `Bearer ${user.accessToken}`,
      });

      if (response && response.response?.status === 200) {
        toast.success("Payment released successfully!");
        setPayoutDialogOpen(false);
        setSelectedBounty(null);
        fetchBounties();
      } else {
        toast.error("Failed to release payment.");
      }

    } catch (error) {
      console.error("Error releasing payment:", error);
      toast.error("Failed to release payment. Please try again.");
    } finally {
      setPayingOutSubmission(null);
    }
  };

  const handleCustomPayOut = async () => {
    if (!customWalletAddress.trim()) {
      toast.error("Please enter a valid wallet address");
      return;
    }

    // Validate wallet address format
    try {
      new PublicKey(customWalletAddress.trim());
    } catch (error) {
      toast.error("Invalid Solana wallet address format");
      return;
    }

    setPayingOutSubmission(-1); // Use -1 to indicate custom payout

    try {
      const bountyId = selectedBounty!.id;

      const response = await POST("/releasePayment", {
        bountyId: bountyId,
        customWalletAddress: customWalletAddress.trim(),
        isCustomPayout: true
      },{
        Authorization: `Bearer ${user.accessToken}`,
      });

      if (response && response.response?.status === 200) {
        toast.success("Payment released successfully to custom wallet!");
        setPayoutDialogOpen(false);
        setSelectedBounty(null);
        setCustomWalletAddress("");
        setShowCustomWalletInput(false);
        fetchBounties();
      } else {
        toast.error("Failed to update payment status in database.");
      }

    } catch (error) {
      console.error("Error completing bounty with custom wallet:", error);
      toast.error("Failed to complete payout. Please try again.");
    } finally {
      setPayingOutSubmission(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-emerald-500 mx-auto"></div>
            <p className="text-slate-400 font-medium">Loading bounties...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 px-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">Admin Bounties</CardTitle>
              <p className="text-sm text-slate-500">Manage all bounties and process payments</p>
            </div>
            <Button variant="outline" onClick={fetchBounties} disabled={loading}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[1200px] text-center">
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-700">
                  <TableHead className="w-[80px] font-semibold text-slate-700 dark:text-slate-300 text-center">ID</TableHead>
                  <TableHead className="w-[280px] font-semibold text-slate-700 dark:text-slate-300 text-center">Bounty</TableHead>
                  <TableHead className="w-[200px] font-semibold text-slate-700 dark:text-slate-300 text-center">Sponsor</TableHead>
                  <TableHead className="w-[120px] font-semibold text-slate-700 dark:text-slate-300 text-center">Amount</TableHead>
                  <TableHead className="w-[140px] font-semibold text-slate-700 dark:text-slate-300 text-center">Status</TableHead>
                  <TableHead className="w-[120px] font-semibold text-slate-700 dark:text-slate-300 text-center">Submissions</TableHead>
                  <TableHead className="w-[160px] font-semibold text-slate-700 dark:text-slate-300 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bounties.map((bounty) => {
                  const statusInfo = getStatusInfo(bounty.status);
                  const StatusIcon = statusInfo.icon;

                  return (
                    <TableRow key={bounty.id} className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <TableCell className="text-center">
                        <span className="text-sm font-mono text-slate-500 dark:text-slate-400">#{bounty.id}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{bounty.bountyname}</div>
                          {bounty.repoName && bounty.issueNumber && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {bounty.repoName} #{bounty.issueNumber}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">{bounty.sponsor.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{bounty.price} USDC</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{bounty.submissions.length}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelBounty(bounty)}
                            disabled={cancellingBounty === bounty.id || bounty.status === 7}
                            className={`${
                              bounty.status === 8 
                                ? "border-orange-500 text-orange-400 hover:bg-orange-500/10" 
                                : "border-red-500 text-red-400 hover:bg-red-500/10"
                            }`}
                          >
                            {cancellingBounty === bounty.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent"></div>
                            ) : (
                              <XCircle className="w-4 h-4 mr-1" />
                            )}
                            {bounty.status === 8 ? "Approve Cancel" : "Cancel"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedBounty(bounty);
                              setPayoutDialogOpen(true);
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Pay Out
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pay Out Dialog */}
      <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
        <DialogContent className="bg-black border border-slate-700 max-w-4xl">
          <DialogHeader className="text-center">
            <DialogTitle>Pay Out Bounty: {selectedBounty?.bountyname}</DialogTitle>
            <DialogDescription>
              Select a submission to pay out the bounty amount or use a custom wallet address
            </DialogDescription>
          </DialogHeader>

          {/* Custom Wallet Input Section */}
          <div className="mb-6 p-4 border border-slate-600 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-slate-200 font-medium">Custom Wallet Payout</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCustomWalletInput(!showCustomWalletInput);
                  setCustomWalletAddress("");
                }}
                className="text-slate-300 border-slate-600 hover:bg-slate-700"
              >
                {showCustomWalletInput ? "Hide" : "Show"} Custom Wallet
              </Button>
            </div>
            
            {showCustomWalletInput && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Wallet Address
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter Solana wallet address..."
                    value={customWalletAddress}
                    onChange={(e) => setCustomWalletAddress(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-slate-200 placeholder:text-slate-500"
                  />
                </div>
                <Button
                  onClick={() => handleCustomPayOut()}
                  disabled={!customWalletAddress.trim() || payingOutSubmission === -1}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                >
                  {payingOutSubmission === -1 ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <DollarSign className="w-4 h-4 mr-1" />
                  )}
                  Assign and Pay custom wallet.
                </Button>
              </div>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            <Table className="text-center">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-slate-300 text-center">Wallet Address</TableHead>
                  <TableHead className="text-slate-300 text-center">PR</TableHead>
                  <TableHead className="text-slate-300 text-center">Status</TableHead>
                  <TableHead className="text-slate-300 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  if (!selectedBounty) return null;
                  
                  // Check if there's a winner submission
                  const winnerSubmission = selectedBounty.submissions.find(s => s.status === 2);
                  
                  // If there's a winner, only show the winner submission
                  // If no winner, show all submissions
                  const submissionsToShow = winnerSubmission ? [winnerSubmission] : selectedBounty.submissions;
                  
                  return submissionsToShow.map((submission) => {
                    const submissionStatusInfo = getStatusInfo(submission.status);
                    const SubmissionStatusIcon = submissionStatusInfo.icon;
                    const isWinner = submission.status === 2;

                    return (
                      <TableRow key={submission.id}>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Wallet className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-300 font-mono text-sm">
                              {formatWalletAddress(submission.walletAddress || "")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {submission.githubPRNumber ? (
                            <a
                              href={`https://github.com/${selectedBounty.repoName}/pull/${submission.githubPRNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1 text-blue-400 hover:text-blue-300"
                            >
                              <ExternalLink className="w-4 h-4" />
                              PR #{submission.githubPRNumber}
                            </a>
                          ) : (
                            <span className="text-slate-500">No PR</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={submissionStatusInfo.color}>
                            <SubmissionStatusIcon className="w-3 h-3 mr-1" />
                            {submissionStatusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => isWinner ? handlePayOut(submission) : handleCustomPayOutForSubmission(submission)}
                            disabled={payingOutSubmission === submission.id || !submission.walletAddress}
                            className={`${
                              isWinner 
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                            }`}
                          >
                            {payingOutSubmission === submission.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            ) : (
                              <DollarSign className="w-4 h-4 mr-1" />
                            )}
                            {isWinner ? "Pay Out" : "Assign & Pay"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPayoutDialogOpen(false);
                setSelectedBounty(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
