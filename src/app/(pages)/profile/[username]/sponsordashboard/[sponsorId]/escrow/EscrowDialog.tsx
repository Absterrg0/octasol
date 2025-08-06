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
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"
import { 
  ExternalLink, 
  GitPullRequest, 
  Lock, 
  DollarSign, 
  User, 
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Wallet,
  Shield
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
  // Add other issue properties as needed
}

type Submission = {
  id: number
  githubId: number
  githubPRNumber?: number
  links: string[]
  notes?: string
  status: number // 0: draft, 1: submitted, 2: is winner, 3: rejected
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
  isOpen:boolean;
  onOpenChange:(open:boolean)=>void;
}

const PROGRAM_ID = new web3.PublicKey(idl.address)
const MINT_PUBKEY = new web3.PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") // Devnet USDC

export default function EscrowDialog({ issue,isOpen,onOpenChange }: EscrowDialogProps) {
  const selectedRepo = useSelector((state: any) => state.selectedRepo)
  const user = useSelector((state: any) => state.user)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [bounty, setBounty] = useState<any>()
  const [loading, setLoading] = useState(false)
  const [creatingEscrow, setCreatingEscrow] = useState<{ [key: number]: boolean }>({})
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null)
  const { connection } = useConnection()
  const wallet = useWallet()
 

  const getStatusInfo = (status: number) => {
    switch (status) {
      case 0:
        return { 
          label: "Draft", 
          icon: Clock, 
          variant: "secondary" as const,
          description: "Work in progress",
          color: "text-orange-400 bg-orange-500/10 border-orange-500/20"
        }
      case 1:
        return { 
          label: "Submitted", 
          icon: CheckCircle, 
          variant: "default" as const,
          description: "Awaiting review",
          color: "text-blue-400 bg-blue-500/10 border-blue-500/20"
        }
      case 2:
        return { 
          label: "Winner", 
          icon: CheckCircle, 
          variant: "default" as const,
          description: "Selected as winner",
          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
        }
      case 3:
        return { 
          label: "Rejected", 
          icon: XCircle, 
          variant: "destructive" as const,
          description: "Not selected",
          color: "text-red-400 bg-red-500/10 border-red-500/20"
        }
      default:
        return { 
          label: "Unknown", 
          icon: AlertCircle, 
          variant: "outline" as const,
          description: "",
          color: "text-slate-400 bg-slate-500/10 border-slate-500/20"
        }
    }
  }

  function generateBountyKeypair(bountyId: string): Keypair {
    const seedString = `octasol_bounty_${bountyId}`;
    const hash = createHash('sha256').update(seedString).digest();
    const keypairSeed = hash.slice(0, 32);
    return Keypair.fromSeed(keypairSeed);
  }

  const handleCreateEscrow = async (
    submission: Submission,
  ): Promise<void> => {
    setCreatingEscrow((prev) => ({ ...prev, [submission.id]: true }));
  
    try {
      // 1. Centralize and simplify pre-flight checks
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
  
      // 2. Consistent Naming & Type Safety for Wallet Adapter
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      };
  
      // 3. Use an existing Connection instance if available, or create a new one.
      // The commitment levels you chose are a good balance of speed and reliability.
      const provider = new AnchorProvider(connection, anchorWallet, {
        preflightCommitment: 'confirmed',
        commitment: 'confirmed',
      });
      const program = new Program(idl, provider);
  
      // 4. Use a more descriptive variable name
      const bountyKeypair = generateBountyKeypair(submission.bountyId.toString());
  
      const txHash = await program.methods
        .assignContributor()
        .accounts({
          maintainer: wallet.publicKey,
          bounty: bountyKeypair.publicKey,
          contributor: new PublicKey(submission.walletAddress), // Ensure this is a PublicKey
          systemProgram: SystemProgram.programId,
        })
        .rpc();
  
  
      const updateStatusResponse = await POST(`/updateSubmissionStatus`, {
        submissionId: submission.id,
        githubId: user.githubId,
      });
  
      if (updateStatusResponse) {
        toast.success('Contributor assigned successfully!');
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
          // Fallback to a generic but still informative error
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
      console.log(response.submissions)
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

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && submissions.length === 0) {
      onOpenChange(true)
      fetchSubmissions()
   
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
    <Dialog  open={isOpen} onOpenChange={handleOpenChange}>
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
      <DialogContent className="max-w-6xl w-full max-h-[95vh] p-0 border-2 border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b-2 border-slate-700 bg-black">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-800 border-2 border-slate-600 rounded-xl">
                  <GitPullRequest className="w-6 h-6 text-slate-300" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-100">Bounty Submissions</h2>
                  <div className="flex items-center gap-2 mt-2 text-slate-400">
                    <span className="font-medium">Issue #{issue.number}:</span>
                    <span>{issue.title}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bounty Overview */}
        {bounty && (
          <div className="mx-8 mt-6 bg-gradient-to-r from-emerald-500/5 to-green-500/5 border-2 border-emerald-500/20 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/20 rounded-xl">
                  <DollarSign className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold text-emerald-400">
                      ${bounty.price}
                    </span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl">
                      USDC
                    </Badge>
                  </div>
                  <p className="text-emerald-300/80 font-medium">Total Bounty Amount</p>
                </div>
              </div>
              <div className="text-right space-y-3">
           
                <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-2">
                  <Calendar className="w-4 h-4" />
                  Created {formatDate(bounty.createdAt)}
                </div>
                {bounty.skills && bounty.skills.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {bounty.skills.slice(0, 3).map((skill: string, index: number) => (
                      <Badge key={index} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-2 py-1 rounded-lg">
                        {skill}
                      </Badge>
                    ))}
                    {bounty.skills.length > 3 && (
                      <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs px-2 py-1 rounded-lg">
                        +{bounty.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Separator */}
        <div className="mx-8 my-6">
          <div className="h-[2px] bg-slate-700 rounded-full"></div>
        </div>

        <div className="flex-1 overflow-hidden px-8 pb-8">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-700 border-t-emerald-500 mx-auto"></div>
                  <p className="text-slate-400 font-medium">Loading submissions...</p>
                </div>
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-16 space-y-6">
                <div className="p-6 bg-slate-800/50 border-2 border-slate-700 rounded-2xl w-fit mx-auto">
                  <GitPullRequest className="w-12 h-12 text-slate-500" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-slate-200 mb-2">No submissions yet</h3>
                  <p className="text-slate-400">
                    Once developers submit their work, it will appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {submissions.map((submission, index) => {
                  const statusInfo = getStatusInfo(submission.status)
                  const StatusIcon = statusInfo.icon

                  return (
                    <div key={submission.id} className="bg-black border-2 border-slate-700 hover:border-slate-600 rounded-2xl transition-all shadow-lg overflow-hidden">
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
                                  <span className="font-bold text-lg text-slate-100">Submission #{index + 1}</span>
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
                                {formatDate(submission.createdAt)}
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
                                  {formatWalletAddress(submission.walletAddress || "")}
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
                                {submission.links && submission.links.length > 0 ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-auto p-2 text-xs bg-slate-900 border border-slate-600 hover:border-blue-500 hover:bg-slate-800 text-blue-400 rounded-lg transition-all"
                                    onClick={() => window.open(submission.links[0], "_blank")}
                                  >
                                    View PR #{submission.githubPRNumber || 'N/A'}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-slate-700">No PR link</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Notes */}
                          {submission.notes && (
                            <div className="p-4 bg-slate-800/20 border border-slate-600 rounded-xl">
                              <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Notes
                              </p>
                              <p className="text-sm text-slate-400 leading-relaxed">{submission.notes}</p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-between pt-4 border-t-2 border-slate-700">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Shield className="w-4 h-4" />
                              <span>Escrow Protection Available</span>
                            </div>
                            
                            <Button
                              size="sm"
                              onClick={() => handleCreateEscrow(submission)}
                              disabled={creatingEscrow[submission.id]}
                              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-2 border-emerald-500 hover:border-emerald-400 rounded-xl px-4 py-2 font-semibold transition-all shadow-lg gap-2"
                            >
                              <Lock className="w-4 h-4" />
                              {creatingEscrow[submission.id] ? 'Creating...' : 'Lock Escrow'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}