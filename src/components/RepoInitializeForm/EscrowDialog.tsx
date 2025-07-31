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
import { GET } from "@/config/axios/requests"
import idl from "../../../contract/idl/octasol_contract.json"
import type { OctasolContract } from "../../../contract/types/octasol_contract"
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
}

const PROGRAM_ID = new web3.PublicKey(idl.address)
const MINT_PUBKEY = new web3.PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU") // Devnet USDC

export default function EscrowDialog({ issue }: EscrowDialogProps) {
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
          description: "Work in progress"
        }
      case 1:
        return { 
          label: "Submitted", 
          icon: CheckCircle, 
          variant: "default" as const,
          description: "Awaiting review"
        }
      case 2:
        return { 
          label: "Winner", 
          icon: CheckCircle, 
          variant: "default" as const,
          description: "Selected as winner"
        }
      case 3:
        return { 
          label: "Rejected", 
          icon: XCircle, 
          variant: "destructive" as const,
          description: "Not selected"
        }
      default:
        return { 
          label: "Unknown", 
          icon: AlertCircle, 
          variant: "outline" as const,
          description: ""
        }
    }
  }

  const checkTokenBalance = async (tokenAccount: web3.PublicKey, requiredAmount: BN) => {
    try {
      const accountInfo = await connection.getAccountInfo(tokenAccount)
      if (!accountInfo) {
        return { hasBalance: false, balance: new BN(0) }
      }

      // Parse token account data to get balance
      const accountData = accountInfo.data
      const balance = new BN(accountData.slice(64, 72), 'le') // Token amount is at bytes 64-71

      return {
        hasBalance: balance.gte(requiredAmount),
        balance: balance
      }
    } catch (error) {
      return { hasBalance: false, balance: new BN(0) }
    }
  }

  const handleCreateEscrow = async (submission: Submission) => {
    if (!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      toast.error("Please connect your wallet first")
      return
    }

    if (!user?.githubId) {
      toast.error("Could not find maintainer's GitHub ID. Please log in again.")
      return
    }

    if (!submission.walletAddress) {
      toast.error("Submission does not have a wallet address")
      return
    }

    setCreatingEscrow((prev) => ({ ...prev, [submission.id]: true }))

    try {
      // Create anchor wallet interface
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      }

      // Set up provider and program with consistent commitment levels
      const provider = new AnchorProvider(connection, anchorWallet, { 
        preflightCommitment: "confirmed", // Changed from "processed"
        commitment: "confirmed" // Changed from "processed"
      })
      const program = new Program(idl as OctasolContract, provider)

      // Convert values to BN
      const bountyIdBN = new BN(submission.id)
      const amountBN = new BN(bounty?.price * 1000000 || 10000000) // Convert to proper decimals for USDC


      // Get maintainer's token account
      const maintainerTokenAccount = getAssociatedTokenAddressSync(
        MINT_PUBKEY,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      );

      const bountyAccountKp = Keypair.generate();
      
      const [escrowAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_auth"), bountyAccountKp.publicKey.toBuffer()],
        program.programId
      );

    // Derive the address for the escrow's token account (an ATA owned by the PDA)
    const escrowTokenAccount = await getAssociatedTokenAddress(
        MINT_PUBKEY,
        escrowAuthorityPda, // The owner is the PDA
        true // IMPORTANT: This must be true for PDA-owned accounts
    );



      console.log("=== ESCROW CREATION DEBUG ===")
      console.log("Program ID:", PROGRAM_ID.toString())
      console.log("Maintainer:", wallet.publicKey.toString())
      console.log("Maintainer Token Account:", maintainerTokenAccount.toString())
      console.log("Contributor:", submission.walletAddress)
      console.log("Amount:", amountBN.toString())
      console.log("USDC Mint:", MINT_PUBKEY.toString())

      // Check token balance BEFORE creating transaction
      const { hasBalance, balance } = await checkTokenBalance(maintainerTokenAccount, amountBN)
      
      if (!hasBalance) {
        const requiredUSDC = (bounty?.price || 10) // Convert back to human readable
        const currentUSDC = balance.toNumber() / 1000000 // Convert from micro USDC
        
        toast.error(
          `Insufficient USDC balance!\n\n` +
          `Required: ${requiredUSDC} USDC\n` +
          `Current: ${currentUSDC} USDC\n\n` +
          `Please add USDC to your wallet first.\n` +
          `Devnet USDC Mint: ${MINT_PUBKEY.toString()}`
        )
        return
      }

      
      
       {
        console.log("Creating new bounty...")

        // Check if maintainer token account exists
        const maintainerTokenAccountInfo = await connection.getAccountInfo(maintainerTokenAccount)
        
        // Build transaction step by step with proper error handling
        const transaction = new web3.Transaction()
        
        // Create maintainer token account if it doesn't exist
        if (!maintainerTokenAccountInfo) {
          console.log("Creating maintainer token account...")
          const createTokenAccountIx = createAssociatedTokenAccountInstruction(
            wallet.publicKey, // payer
            maintainerTokenAccount, // associated token account
            wallet.publicKey, // owner
            MINT_PUBKEY, // mint
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
          transaction.add(createTokenAccountIx)
        }

        //Temp solution
        const keeper = Keypair.generate();
        // Create initialize bounty instruction with explicit account mapping
        const initBountyIx = await program.methods
          .initializeBounty(bountyIdBN, amountBN)
          .accounts({
            maintainer: wallet.publicKey,
            bounty: bountyAccountKp.publicKey,
            maintainerTokenAccount: maintainerTokenAccount,
            escrowAuthority: escrowAuthorityPda,
            keeper: keeper.publicKey,
            escrowTokenAccount: escrowTokenAccount,
            mint: MINT_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: web3.SYSVAR_RENT_PUBKEY,
          })
          .instruction()

        transaction.add(initBountyIx)

        // Set recent blockhash and fee payer
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
        transaction.recentBlockhash = blockhash
        transaction.feePayer = wallet.publicKey

        // Simulate transaction first with better error handling
        console.log("Simulating transaction...")
        try {
          const simulation = await connection.simulateTransaction(transaction)
          
          if (simulation.value.err) {
            console.error("Simulation failed:", simulation.value.err)
            console.error("Logs:", simulation.value.logs)
            throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`)
          }

          console.log("Simulation successful!")
          console.log("Compute units used:", simulation.value.unitsConsumed)
          console.log("Logs:", simulation.value.logs)
        } catch (simError) {
          console.error("Simulation error:", simError)
          throw new Error(`Simulation failed: ${simError instanceof Error ? simError.message : String(simError)}`)
        }

        // Sign and send transaction
        console.log("Signing transaction...")
        const signedTransaction = await wallet.signTransaction!(transaction)
        
        console.log("Sending transaction...")
        const txHash = await connection.sendRawTransaction(signedTransaction.serialize(), {
          skipPreflight: false, // Enable preflight for additional validation
          preflightCommitment: 'confirmed',
          maxRetries: 3,
        })

        console.log("Transaction sent, waiting for confirmation...")
        
        // Wait for confirmation with timeout
        const confirmation = await connection.confirmTransaction({
          signature: txHash,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed')

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
        }

        console.log("Transaction confirmed:", txHash)
        toast.success(`Escrow created successfully! TX: ${txHash.slice(0, 8)}...`)
        
        // Refresh submissions
        await fetchSubmissions()
      } 
    } catch (error) {
      console.error("Error creating escrow:", error)
      
      // Better error messages
      let errorMessage = "Failed to create escrow"
      if (error instanceof Error) {
        if (error.message.includes("insufficient funds")) {
          errorMessage = "Insufficient SOL for transaction fees"
        } else if (error.message.includes("Simulation failed")) {
          errorMessage = `Transaction simulation failed: ${error.message}`
        } else if (error.message.includes("User rejected")) {
          errorMessage = "Transaction was rejected in wallet"
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error(errorMessage)
    } finally {
      setCreatingEscrow((prev) => ({ ...prev, [submission.id]: false }))
    }
  }

  const fetchUsdcBalance = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setUsdcBalance(null)
      return
    }

    try {
      const tokenAccount = getAssociatedTokenAddressSync(
        MINT_PUBKEY,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID
      )

      const { balance } = await checkTokenBalance(tokenAccount, new BN(0))
      setUsdcBalance(balance.toNumber() / 1000000) // Convert from micro USDC
    } catch (error) {
      console.error("Error fetching USDC balance:", error)
      setUsdcBalance(0)
    }
  }

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
      fetchSubmissions()
      fetchUsdcBalance()
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
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <GitPullRequest className="w-4 h-4" />
          View Submissions
          {submissions.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {submissions.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <GitPullRequest className="w-5 h-5" />
            </div>
            Bounty Submissions
          </DialogTitle>
          <DialogDescription className="text-base">
            <div className="flex items-center gap-2 mt-2">
              <span className="font-medium">Issue #{issue.number}:</span>
              <span>{issue.title}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Bounty Overview */}
        {bounty && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-xl p-6 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                      ${bounty.price}
                    </span>
                    <span className="text-sm text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded-full">
                      USDC
                    </span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">Total Bounty Amount</p>
                </div>
              </div>
              <div className="text-right space-y-2">
                {/* Wallet Balance */}
                {wallet.connected && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wallet className="w-4 h-4" />
                    <span>Your Balance:</span>
                    <span className={`font-mono font-medium ${
                      usdcBalance !== null && usdcBalance >= bounty.price 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {usdcBalance !== null ? `${usdcBalance.toFixed(2)} USDC` : 'Loading...'}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Created {formatDate(bounty.createdAt)}
                </div>
                {bounty.skills && bounty.skills.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {bounty.skills.slice(0, 3).map((skill: string, index: number) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {bounty.skills.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{bounty.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Separator />

        <ScrollArea className="max-h-[45vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading submissions...</p>
              </div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="p-4 bg-muted/30 rounded-full w-fit mx-auto">
                <GitPullRequest className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-lg">No submissions yet</h3>
                <p className="text-sm text-muted-foreground">
                  Once developers submit their work, it will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission, index) => {
                const statusInfo = getStatusInfo(submission.status)
                const StatusIcon = statusInfo.icon

                return (
                  <Card key={submission.id} className="transition-all hover:shadow-md border-l-4 border-l-primary/20">
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">Submission #{index + 1}</span>
                                <Badge variant={statusInfo.variant} className="gap-1">
                                  <StatusIcon className="w-3 h-3" />
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {statusInfo.description}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(submission.createdAt)}
                            </div>
                          </div>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Wallet Info */}
                          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                            <Wallet className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Wallet Address</p>
                              <code className="text-xs text-muted-foreground font-mono">
                                {formatWalletAddress(submission.walletAddress || "")}
                              </code>
                            </div>
                          </div>

                          {/* PR Link */}
                          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                            <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Pull Request</p>
                              {submission.links && submission.links.length > 0 ? (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs"
                                  onClick={() => window.open(submission.links[0], "_blank")}
                                >
                                  View PR #{submission.githubPRNumber || 'N/A'}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">No PR link</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        {submission.notes && (
                          <div className="p-3 bg-muted/20 rounded-lg">
                            <p className="text-sm font-medium mb-1">Notes</p>
                            <p className="text-sm text-muted-foreground">{submission.notes}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Shield className="w-4 h-4" />
                            <span>Escrow Protection Available</span>
                          </div>
                          
                          <Button
                            size="sm"
                            onClick={() => handleCreateEscrow(submission)}
                            disabled={creatingEscrow[submission.id] || !submission.walletAddress}
                            className="bg-green-600 hover:bg-green-700 gap-2"
                          >
                            <Lock className="w-3 h-3" />
                            {creatingEscrow[submission.id] ? "Creating Escrow..." : "Lock Escrow"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}