"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useState, useEffect } from "react"
import { 
  ExternalLink, 
  GitPullRequest, 
  Lock, 
  Wallet,
  User,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Shield,
  DollarSign
} from "lucide-react"
import { useSelector } from "react-redux"
import { GET, POST } from "@/config/axios/requests"
import idl from "../../../../../../../../contract/idl/octasol_contract.json"
import type { OctasolContract } from "../../../../../../../../contract/types/octasol_contract"
import { AnchorProvider, Program, web3, BN } from "@coral-xyz/anchor"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddressSync, 
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress
} from "@solana/spl-token"
import { toast } from 'react-toastify';
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js"
import { createHash } from "crypto"

type Issue = {
  number: number
  title: string
}

type Submission = {
  id: number
  githubId: number
  githubPRNumber?: number
  links: string[]
  notes?: string
  status: number
  walletAddress?: string
  createdAt: string
  updatedAt: string
  bountyId: number
  bounty?: {
    bountyDescription: string
    bountyname: string
    createdAt: string
    escrowPda: string | null
    id: number
    issueNumber: number
    price: number
    primaryContact: string
    repoName: string
    skills: string[]
    sponsorId: number | null
    status: number
    time: string
    timeExtendedTo: string | null
    transactionHash: string | null
    updatedAt: string
  }
}

type EscrowDialogProps = {
  issue: Issue
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EscrowDialog({ issue, isOpen, onOpenChange }: EscrowDialogProps) {
  const selectedRepo = useSelector((state: any) => state.selectedRepo)
  const user = useSelector((state: any) => state.user)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [bounty, setBounty] = useState<any>()
  const [loading, setLoading] = useState(false)
  const [creatingEscrow, setCreatingEscrow] = useState<{ [key: number]: boolean }>({})
  const { connection } = useConnection()
  const wallet = useWallet()

  useEffect(() => {
    if (isOpen && submissions.length === 0) {
      fetchSubmissions()
    }
  }, [isOpen])

  const getStatusInfo = (status: number) => {
    switch (status) {
      case 0:
        return { 
          label: "Draft", 
          icon: Clock, 
          color: "text-orange-400 bg-orange-500/10 border-orange-500/20"
        }
      case 1:
        return { 
          label: "Submitted", 
          icon: CheckCircle, 
          color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
        }
      case 2:
        return { 
          label: "Winner", 
          icon: CheckCircle, 
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        }
      case 3:
        return { 
          label: "Rejected", 
          icon: XCircle, 
          color: "text-red-400 bg-red-500/10 border-red-500/20"
        }
      default:
        return { 
          label: "Unknown", 
          icon: AlertCircle, 
          color: "text-slate-400 bg-slate-500/10 border-slate-500/20"
        }
    }
  }

  function generateBountyKeypair(bountyId: string): Keypair {
    const seedString = `octasol_${bountyId}`;
    const hash = createHash('sha256').update(seedString).digest();
    const keypairSeed = hash.slice(0, 32);
    return Keypair.fromSeed(keypairSeed);
  }

  const handleCreateEscrow = async (submission: Submission): Promise<void> => {
    setCreatingEscrow((prev) => ({ ...prev, [submission.id]: true }));
  
    try {
      if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Please connect your wallet first.');
      }
      if (!user?.githubId) {
        throw new Error('Maintainer GitHub ID not found. Please log in again.');
      }
      if (!submission.walletAddress) {
        throw new Error('Submission is missing a wallet address.');
      }
      if (!wallet.signAllTransactions) {
        throw new Error('Wallet does not support `signAllTransactions`.');
      }
  
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };
  
      const provider = new AnchorProvider(connection, anchorWallet, {
        preflightCommitment: 'confirmed',
        commitment: 'confirmed',
      });
      const program = new Program(idl, provider);
  
      const bountyKeypair = generateBountyKeypair(submission.bountyId.toString());
  
      const txHash = await program.methods
        .assignContributor()
        .accounts({
          maintainer: wallet.publicKey,
          bounty: bountyKeypair.publicKey,
          contributor: new PublicKey(submission.walletAddress),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
  
      const updateStatusResponse = await POST(`/updateSubmissionStatus`, {
        submissionId: submission.id,
        githubId: user.githubId,
    });
  
      if (updateStatusResponse) {
        toast.success('Contributor assigned successfully!');
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Error creating escrow:', error);
  
      let errorMessage = 'Failed to create escrow.';
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction was rejected in your wallet.';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = 'You have insufficient SOL for the transaction fees.';
        } else if (error.message.includes('Simulation failed')) {
          errorMessage = 'Transaction simulation failed. Please try again.';
        } else {
          errorMessage = `An error occurred: ${error.message}`;
        }
      }
      toast.error(errorMessage);
    } finally {
      setCreatingEscrow((prev) => ({ ...prev, [submission.id]: false }));
    }
  };

  const fetchSubmissions = async () => {
    if (!selectedRepo?.full_name) return
    setLoading(true)
    try {
      const response = await GET(
        `/getBountySubmission?issueNumber=${issue.number.toString()}&repoName=${selectedRepo.full_name}`,
      )
      setSubmissions(response.submissions || [])
      if (response && response.submissions && response.submissions.length > 0 && response.submissions[0].bounty) {
        setBounty(response.submissions[0].bounty)
      }
    } catch (error) {
      console.error("Error fetching submissions:", error)
      setSubmissions([])
    } finally {
      setLoading(false)
    }
  }

  const formatWalletAddress = (address: string) => {
    if (!address) return "No wallet address"
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',  
      minute: '2-digit'
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all ">
          <GitPullRequest className="w-4 h-4" />
          View Submissions
          {submissions.length > 0 && (
            <Badge className="ml-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {submissions.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
 
      <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0 border-2 border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-slate-700 bg-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 border border-slate-600 rounded-lg">
                <GitPullRequest className="w-5 h-5 text-slate-300" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Bounty Submissions</h2>
                <p className="text-sm text-slate-400">Issue #{issue.number}: {issue.title}</p>
              </div>
            </div>
            {bounty && (
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1">
                <DollarSign className="w-4 h-4" />
                ${bounty.price} USDC
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-700 border-t-emerald-500 mx-auto mb-4"></div>
                  <p className="text-slate-400 font-medium">Loading submissions...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl w-fit mx-auto mb-4">
                    <GitPullRequest className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-200 mb-2">No submissions yet</h3>
                  <p className="text-slate-400">Once developers submit their work, it will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission, index) => {
                    const statusInfo = getStatusInfo(submission.status)
                    const StatusIcon = statusInfo.icon

                    return (
                      <Card key={submission.id} className="border border-slate-700 bg-slate-900/30 hover:bg-slate-900/50 transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            {/* Left: Submission Info */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <div className="p-2 bg-slate-800 border border-slate-600 rounded-lg">
                                  <User className="w-4 h-4 text-slate-300" />
                                </div>
                                <span className="text-sm font-medium text-slate-200">#{index + 1}</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  <Wallet className="w-4 h-4 text-slate-400" />
                                  <span className="text-sm text-slate-300 font-mono">
                                    {formatWalletAddress(submission.walletAddress || "")}
                                  </span>
                                </div>
                                
                                {submission.links && submission.links.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs bg-slate-800 border border-slate-600 hover:border-blue-500 hover:bg-slate-700 text-blue-400"
                                    onClick={() => window.open(submission.links[0], "_blank")}
                                  >
                                    <ExternalLink className="w-3 h-3 mr-1" />
                                    PR #{submission.githubPRNumber || 'N/A'}
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Right: Status and Actions */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Badge className={`gap-1 px-2 py-1 text-xs border ${statusInfo.color}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusInfo.label}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(submission.createdAt)}
                                </div>
                              </div>
                              
                              <Separator orientation="vertical" className="h-6 bg-slate-600" />
                              
                              <Button
                                size="sm"
                                onClick={() => handleCreateEscrow(submission)}
                                disabled={creatingEscrow[submission.id]}
                                className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border border-emerald-500 hover:border-emerald-400"
                              >
                                <Lock className="w-3 h-3 mr-1" />
                                {creatingEscrow[submission.id] ? 'Creating...' : 'Lock Escrow'}
                              </Button>
                            </div>
                          </div>

                          {/* Notes (if available) */}
                          {submission.notes && (
                            <div className="mt-3 pt-3 border-t border-slate-700">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-slate-400 leading-relaxed">{submission.notes}</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}