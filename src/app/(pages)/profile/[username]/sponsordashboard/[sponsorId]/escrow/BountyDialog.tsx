"use client"
import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { CalendarIcon, GitBranch, Loader2, Plus } from "lucide-react"

// UI Components
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MultiSelect } from "@/components/ui/multi-select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import RichTextEditor from "@/components/RichTextEditor"
import { Badge } from "@/components/ui/badge"

// Redux & API
import { POST, PUT } from "@/config/axios/requests"
import { clearError, setError } from "@/app/Redux/Features/error/error"

// Utils
import { cn } from "@/lib/utils"

// Types
import type { Issue } from "@/app/Redux/Features/git/issues"
import { extractTextFromHTML } from "../../../../../../../components/Bounty"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import {toast} from 'react-toastify';
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor"
import { OctasolContract } from "../../../../../../../../contract/types/octasol_contract"
import idl from "../../../../../../../../contract/idl/octasol_contract.json"
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
import { createHash } from "crypto"

// --- Form Schema Definition ---
const bountyFormSchema = z.object({
  title: z
    .string()
    .min(5, { message: "Bounty title must be at least 5 characters." })
    .max(100, { message: "Title cannot exceed 100 characters." }),
  price: z.coerce
    .number({ required_error: "Reward amount is required." })
    .min(1, { message: "Bounty must be at least $1." }),
  description: z.string(),
  skills: z.array(z.string()).min(1, { message: "Please select at least one skill." }),
  deadline: z.date({ required_error: "A deadline is required." }),
  contact: z.string().min(3, { message: "Please provide a valid contact method." }),
})

type BountyFormData = z.infer<typeof bountyFormSchema>

const frameworksList = [
  { value: "Frontend", label: "Frontend" },
  { value: "Backend", label: "Backend" },
  { value: "Blockchain", label: "Blockchain" },
  { value: "UI/UX", label: "UI/UX" },
  { value: "Content Writing", label: "Content Writing" },
  { value: "DevOps", label: "DevOps" },
  { value: "AI/ML", label: "AI/ML" },
]

// --- Component Definition ---
interface BountyDialogProps {

  issue: Issue | null
}

export function BountyDialog({ issue }: BountyDialogProps) {
  const dispatch = useDispatch()
  const user = useSelector((state: any) => state.user)
  const selectedRepo = useSelector((state:any)=>state.selectedRepo);
  const [isLoading, setIsLoading] = useState(false)
  const { connection } = useConnection()
  
  const wallet = useWallet();
    const form = useForm<BountyFormData>({
    resolver: zodResolver(bountyFormSchema),
    mode: "onTouched",
    defaultValues: {
      title: issue?.title || "",
      price: undefined,
      description: issue?.body || "",
      skills: [],
      deadline: undefined,
      contact: "",
    },
  })

  function generateBountyKeypair(bountyId: string): Keypair {
    // Create a deterministic seed from bounty ID
    const seedString = `octasol_bounty_${bountyId}`;
    const hash = createHash('sha256').update(seedString).digest();
    
    // Take first 32 bytes for keypair seed
    const keypairSeed = hash.slice(0, 32);
    
    return Keypair.fromSeed(keypairSeed);
  }
  
  const onSubmit = async (data: BountyFormData) => {
    if (!user || !selectedRepo || !issue) {
      dispatch(setError("User, repository, or issue data is missing."))
      return
    }
  
    if(!wallet.connected || !wallet.publicKey || !wallet.signTransaction) {
      toast.error("Please connect your wallet first")
      return
    }
  
    setIsLoading(true)
    let bountyId: string | null = null;
    
    try {
      const payload = {
        ...data,
        deadline: data.deadline.toISOString(),
        issueNumber: issue.number,
        repoName: selectedRepo.full_name,
        status: 'CREATING' // Start with CREATING status
      }
  
      // First DB query - create bounty with CREATING status
      const { response, error } = await POST("/create-bounty", payload, {
        Authorization: `Bearer ${user.accessToken}`,
      })
  
      if (!response || response.status !== 200) {
        dispatch(setError("Failed to create bounty record"))
        return
      }
  
      bountyId = response.data.id;
      
      // Setup blockchain transaction
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      }
      
      const provider = new AnchorProvider(connection, anchorWallet, {
        preflightCommitment: "confirmed",
        commitment: "confirmed"
      })
      const program = new Program(idl as OctasolContract, provider)
  
      const bountyIdBN = new BN(bountyId);
      const amountBN = new BN(data.price * 1000000);
  
      const USDCMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  
      const maintainerTokenAccount = getAssociatedTokenAddressSync(USDCMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
  
      // CHANGED: Generate deterministic keypair instead of random
      const bountyAccountKp = generateBountyKeypair(bountyId!);
      
      const [escrowAuthorityPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow_auth"), bountyAccountKp.publicKey.toBuffer()],
        program.programId
      );
      
      const escrowTokenAccount = await getAssociatedTokenAddress(
        USDCMint,
        escrowAuthorityPda,
        true
      );
  
      // Execute blockchain transaction
      console.log("About to initialize bounty on-chain with the following parameters:");
      console.log("bountyId:", bountyId);
      console.log("amountBN:", amountBN.toString());
      console.log("Accounts:");
      console.log({
        maintainer: wallet.publicKey.toString(),
        bounty: bountyAccountKp.publicKey.toString(),
        maintainerTokenAccount: maintainerTokenAccount.toString(),
        escrowAuthority: escrowAuthorityPda.toString(),
        keeper: process.env.NEXT_PUBLIC_ADMIN_PUBLIC_KEY!,
        escrowTokenAccount: escrowTokenAccount.toString(),
        mint: USDCMint.toString(),
        systemProgram: SystemProgram.programId.toString(),
        tokenProgram: TOKEN_PROGRAM_ID.toString(),
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID.toString(),
        rent: SYSVAR_RENT_PUBKEY.toString(),
      });
      console.log("Signers:", [bountyAccountKp.publicKey.toString()]);
  
      let txSignature;
      try {
        txSignature = await program.methods
          .initializeBounty(bountyIdBN, amountBN)
          .accounts({
            maintainer: wallet.publicKey,
            bounty: bountyAccountKp.publicKey,
            maintainerTokenAccount: maintainerTokenAccount,
            escrowAuthority: escrowAuthorityPda,
            keeper: new PublicKey(process.env.NEXT_PUBLIC_ADMIN_PUBLIC_KEY!),
            escrowTokenAccount: escrowTokenAccount,
            mint: USDCMint,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([bountyAccountKp])
          .rpc();
        console.log("Blockchain transaction successful. txSignature:", txSignature);
      } catch (err) {
        console.error("Error during blockchain transaction:", err);
        throw err;
      }
      const payloadPut = {
        ...data,
        deadline: data.deadline.toISOString(),
        issueNumber: issue.number,
        repoName: selectedRepo.full_name,
        status: 'UPDATING' // Start with CREATING status
      }
      console.log(payloadPut);
      // Update bounty with PDA and change status to ACTIVE
      const response2 = await PUT("/create-bounty", {
        bountyId,
        pdaEscrow: escrowAuthorityPda.toString(),
        status: 2,
        githubId: user.githubId,
        blockchainTxSignature: txSignature,
        payload:payloadPut
      })
  
      if (!response2 || response2.status !== 200) {
        // Mark bounty as FAILED instead of deleting
        await PUT("/create-bounty", {
          bountyId,
          status: 7,
        })
        
        dispatch(setError("Failed to complete bounty creation. Transaction has been marked as failed."))
        return
      }
  
      // Success!
      dispatch(clearError())
      toast.success("Bounty created successfully!")
  
    } catch (error) {
      console.error("Error creating bounty:", error)
      
      const payloadPut = {
        ...data,
        deadline: data.deadline.toISOString(),
        issueNumber: issue.number,
        repoName: selectedRepo.full_name,
        status: 'UPDATING' // Start with CREATING status
      }
      // Mark bounty as FAILED if we created one
      if (bountyId) {
        try {
          await PUT("/create-bounty", {
            bountyId,
            status: 7,
            payload:payloadPut            
            })
          console.log("Successfully marked bounty as failed")
        } catch (rollbackError) {
          console.error("Failed to mark bounty as failed:", rollbackError)
        }
      }
      
      toast.error("Failed to create bounty. Please try again.")
      dispatch(setError("Failed to create bounty. Please try again."))
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Plus size={16} />
          Create Bounty
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl w-full max-h-[95vh] p-0 border-0 rounded-2xl shadow-2xl bg-white dark:bg-neutral-950 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-r from-slate-50 via-white to-gray-50 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge
                  variant="default"
                  className="text-sm font-medium px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 rounded-full"
                >
                  Issue #{issue?.number}
                </Badge>
                <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                  <GitBranch className="w-4 h-4" />
                  <span className="font-medium">{selectedRepo?.name}</span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">Create a Bounty</h2>
              <p className="text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Set up a bounty to incentivize community contributions. Define clear requirements and fair compensation.
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 xl:grid-cols-5 h-full gap-0">
                {/* Main Form Area - 3/5 width on xl screens */}
                <div className="xl:col-span-3 overflow-y-auto">
                  <div className="px-8 py-8 space-y-10">
                    {/* Bounty Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                            Bounty Title
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter a clear, descriptive title for your bounty"
                              {...field}
                              className="h-16 text-lg border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/30 transition-all bg-neutral-900 text-neutral-100 placeholder:text-neutral-400"
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                            Description & Requirements <span className="text-xs opacity-70">(Recommended 100 characters)</span>
                          </FormLabel>
                          <FormControl>
                            <div className="border-2 border-neutral-600 dark:border-neutral-600 rounded-xl overflow-hidden focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 dark:focus-within:border-green-400 dark:focus-within:ring-green-900/30 transition-all bg-neutral-900 min-h-[200px]">
                              <RichTextEditor content={field.value} onChange={field.onChange} />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    {/* Skills */}
                
                  </div>
                </div>

                {/* Sidebar - 2/5 width on xl screens */}
                <div className="xl:col-span-2 border-t xl:border-t-0 xl:border-l border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-neutral-50 to-white dark:from-neutral-900 dark:to-neutral-950 rounded-xl">
                  <div className="h-full flex flex-col">
                    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-8">
                      {/* Reward Amount & Contact Method in the same row */}
                      <div className="flex flex-col md:flex-row gap-6 w-full">
                        <div className="flex-1">
                          <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem className="space-y-4">
                                <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                                  Reward Amount
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      placeholder="500"
                                      {...field}
                                      min={1}
                                      step="any"
                                      className="h-16 pl-12 pr-4 text-lg font-semibold border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:focus:border-green-400 dark:focus:ring-green-900/30 transition-all bg-neutral-900 text-neutral-100 placeholder:text-neutral-400"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300 text-xl font-bold pointer-events-none">
                                      $
                                    </span>
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500" />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex-1">
                          <FormField
                            control={form.control}
                            name="contact"
                            render={({ field }) => (
                              <FormItem className="space-y-4">
                                <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                                  Contact Method
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter your contact (e.g. Discord, email)"
                                    {...field}
                                    className="h-16 text-base border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/30 transition-all bg-neutral-900 text-neutral-100 placeholder:text-neutral-400"
                                  />
                                </FormControl>
                                <FormMessage className="text-red-500" />
                              </FormItem>
                            )}
                          />
                          
                        </div>
                      </div>

                      {/* Deadline below */}
                      <div className="flex flex-col gap-6">
                        <FormField
                          control={form.control}
                          name="deadline"
                          render={({ field }) => (
                            <FormItem className="space-y-4">
                              <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                                Deadline
                              </FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className={cn(
                                        "h-16 w-full justify-start text-left font-medium text-lg border-2 border-neutral-600 dark:border-neutral-600 rounded-xl hover:bg-neutral-700 dark:hover:bg-neutral-700 focus:border-orange-500 dark:focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900/30 transition-all bg-neutral-900 text-neutral-100",
                                        !field.value && "text-neutral-400",
                                      )}
                                    >
                                      <CalendarIcon className="mr-3 h-6 w-6" />
                                      {field.value ? format(field.value, "PPP") : <span>Select deadline</span>}
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          )}
                        />
                            <FormField
                      control={form.control}
                      name="skills"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                            Required Skills & Technologies
                          </FormLabel>
                          <FormControl>
                            <MultiSelect
                              options={frameworksList}
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              placeholder="Select the skills and technologies needed"
                              variant="inverted"
                              maxCount={5}
                              className="border-2 border-neutral-600 dark:border-neutral-600 rounded-xl focus:border-purple-500 dark:focus:border-purple-400 bg-neutral-900"
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                      </div>
                    </div>

                    {/* Action Buttons - Fixed at bottom of sidebar */}
                    <div className="flex-shrink-0 px-8 py-6 border-t border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-sm">
                      <div className="flex gap-4">
                        <Button
                          type="submit"
                          disabled={isLoading || !form.formState.isValid}
                          className={cn(
                            "flex-1 h-14 text-lg font-semibold rounded-2xl transition-all flex items-center justify-center shadow-md",
                            form.formState.isValid
                              ? "bg-neutral-800 dark:bg-neutral-900 text-neutral-100 dark:text-neutral-50 border border-neutral-700 dark:border-neutral-800 hover:bg-green-600 dark:hover:bg-green-700 hover:border-green-500 dark:hover:border-green-600 focus:ring-4 focus:ring-green-100 dark:focus:ring-green-900"
                              : "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed border border-neutral-300 dark:border-neutral-700",
                          )}
                        >
                          {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          {"Create Bounty"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
