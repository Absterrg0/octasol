"use client"
import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { format } from "date-fns"
import { AlertCircle, CalendarIcon, Code, Clock, GitBranch, Loader2, Plus } from "lucide-react"
import { Target } from "lucide-react"
import { DollarSign } from "lucide-react"
import { Mail } from "lucide-react"

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
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js"
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
  issue: Issue | null;
  isOpen: boolean;
  onOpenChange:(isOpen:boolean) =>void;
}

export function BountyDialog({ issue,isOpen,onOpenChange }: BountyDialogProps) {
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

  async function checkAccountExists(connection: Connection, accountPublicKey: PublicKey): Promise<boolean> {
    const accountInfo = await connection.getAccountInfo(accountPublicKey);
    return accountInfo !== null;
  }
  
  // Your deterministic keypair generation function
  function generateBountyKeypair(bountyId: string): Keypair {
    const seedString = `octasol_bounty_${bountyId}`;
    const hash = createHash('sha256').update(seedString).digest();
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
  
    setIsLoading(true);
    let bountyId: string | null = null;
    let blockchainTxSignature: string | null = null;
    
    try {
      const payload = {
        ...data,
        deadline: data.deadline.toISOString(),
        issueNumber: issue.number,
        repoName: selectedRepo.full_name,
        status: 1 // CREATING status
      }
  
      // Step 1: Create bounty record in DB first
      const { response, error } = await POST("/create-bounty", payload, {
        Authorization: `Bearer ${user.accessToken}`,
      });
  
      if (!response || response.status !== 200) {
        dispatch(setError("Failed to create bounty record."));
        return;
      }
  
      bountyId = response.data.id;
      
      // Step 2: Setup blockchain transaction
      const anchorWallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions!,
      };
      
      const provider = new AnchorProvider(connection, anchorWallet, {
        preflightCommitment: "confirmed",
        commitment: "confirmed"
      });
      const program = new Program(idl as OctasolContract, provider);
  
      const bountyIdBN = new BN(bountyId);
      const amountBN = new BN(data.price * 1000000);
      const USDCMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
      const maintainerTokenAccount = getAssociatedTokenAddressSync(USDCMint, wallet.publicKey, false, TOKEN_PROGRAM_ID);
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
  
      // Step 3: Check if the on-chain bounty account already exists to prevent crashes
      const bountyAccountExists = await checkAccountExists(connection, bountyAccountKp.publicKey);

      if (bountyAccountExists) {
        console.log(`Bounty account ${bountyAccountKp.publicKey.toString()} already exists on-chain. Skipping initialization.`);
      } else {
        // Execute blockchain transaction only if the account doesn't exist
        try {
          blockchainTxSignature = await program.methods
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
          console.log("Blockchain transaction successful. txSignature:", blockchainTxSignature);

          // Wait for transaction confirmation
          await connection.confirmTransaction(blockchainTxSignature, 'confirmed');
          console.log("Transaction confirmed:", blockchainTxSignature);

        } catch (err) {
          console.error("Error during blockchain transaction:", err);
          throw err;
        }
      }

      // Step 4: Update bounty record in DB with transaction data
      const updatePayload = {
        bountyId,
        pdaEscrow: escrowAuthorityPda.toString(),
        status: 2, // ACTIVE status
        githubId: user.githubId,
        blockchainTxSignature: blockchainTxSignature,
        payload: {
          ...data,
          deadline: data.deadline.toISOString(),
          issueNumber: issue.number,
          repoName: selectedRepo.full_name,
        }
      };

      const response2 = await PUT("/create-bounty", updatePayload);
  
      if (!response2 || response2.status !== 200) {
        // This is a critical failure. On-chain succeeded but DB update failed.
        // The bounty is technically live, but our DB state is wrong.
        dispatch(setError("On-chain transaction succeeded, but DB update failed. Please contact support."));
        return;
      }
  
      // Success!
      dispatch(clearError());
      toast.success("Bounty created successfully!");
  
    } catch (error) {
      console.error("Error creating bounty:", error);
      
      // Mark the bounty as FAILED if we created one in the initial POST
      if (bountyId) {
        try {
          await PUT("/create-bounty", {
            bountyId,
            status: 7, // FAILED
          });
          console.log("Successfully marked bounty as failed");
        } catch (rollbackError) {
          console.error("Failed to mark bounty as failed:", rollbackError);
        }
      }
      
      toast.error("Failed to create bounty. Please try again.");
      dispatch(setError("Failed to create bounty. Please try again."));
    } finally {
      setIsLoading(false);
    }
}


  return (
    <Dialog>
      <DialogTrigger>
        <Button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-slate-500 text-slate-100 rounded-xl transition-all ">
          <Plus size={16} />
          Create Bounty
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-full max-h-[95vh] p-0 border-2 border-slate-700 rounded-2xl shadow-2xl bg-black overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-8 py-6 border-b-2 border-slate-700 bg-black">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Badge className="text-sm font-medium px-4 py-2 bg-slate-800 border-2 border-slate-600 text-slate-200 rounded-xl">
                  Issue #{issue?.number}
                </Badge>
                <div className="flex items-center gap-2 text-slate-400">
                  <GitBranch className="w-4 h-4" />
                  <span className="font-medium">{selectedRepo?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-100 mb-2">Create Bounty</h2>
              <p className="text-lg text-slate-400 leading-relaxed">
                Set up a bounty to incentivize community contributions with clear requirements and fair compensation.
              </p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-1 xl:grid-cols-5 h-full gap-0">
                
                {/* Main Form Area */}
                <div className="xl:col-span-3 overflow-y-auto bg-black">
                  <div className="px-8 py-8 space-y-8">
                    
                    {/* Bounty Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                            <Target className="w-5 h-5 text-emerald-500" />
                            Bounty Title
                          </FormLabel>
                          <FormControl>
                            <input
                              type="text"
                              placeholder="Enter a clear, descriptive title for your bounty"
                              {...field}
                              className="w-full bg-black h-20 text-lg border-2 border-slate-700 rounded-2xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-slate-100 placeholder:text-slate-500 hover:border-slate-600 px-6 py-5 font-semibold shadow-lg"
                            />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                            <Code className="w-5 h-5 text-blue-500" />
                            Description & Requirements
                            <span className="text-xs text-slate-500 font-normal">(Recommended 100+ characters)</span>
                          </FormLabel>
                          <FormControl>
                            <div className="border-2 border-slate-700 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all bg-black">
                              <RichTextEditor content={field.value} onChange={field.onChange} />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />
                         <FormField
                        control={form.control}
                        name="skills"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                              <Code className="w-5 h-5 text-cyan-500" />
                              Required Skills
                            </FormLabel>
                            <FormControl>
                              <MultiSelect
                                options={frameworksList}
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                placeholder="Select required technologies and skills"
                                className="border-2 border-slate-700 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 bg-black hover:border-slate-600"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                  </div>
                </div>

                {/* Sidebar */}
                <div className="xl:col-span-2 border-t-2 xl:border-t-0 xl:border-l-2 border-slate-700 bg-black">
                  <div className="h-full flex flex-col">
                    <div className="flex flex-col gap-8 overflow-y-auto px-8 py-8">
                      
                      {/* Reward Amount & Contact */}
                      <div className="space-y-6">
                        <FormField
                          control={form.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem className="space-y-4">
                              <FormLabel className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                             
                                Reward Amount
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <input
                                    type="number"
                                    placeholder="500"
                                    {...field}
                                    min={1}
                                    step="any"
                                    className="w-full h-16 pl-12 pr-4 text-lg font-semibold border-2 border-slate-700 rounded-xl focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all bg-black text-slate-100 placeholder:text-slate-500 hover:border-slate-600"
                                  />
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 text-xl font-bold pointer-events-none">
                                    $
                                  </span>
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="contact"
                          render={({ field }) => (
                            <FormItem className="space-y-4">
                              <FormLabel className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                                <Mail className="w-5 h-5 text-purple-500" />
                                Contact Method
                              </FormLabel>
                              <FormControl>
                                <input
                                  placeholder="Discord, email, or other contact method"
                                  {...field}
                                  className="w-full  p-4 h-16 text-base border-2 border-slate-700 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all bg-black text-slate-100 placeholder:text-slate-500 hover:border-slate-600"
                                />
                              </FormControl>
                              <FormMessage className="text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Deadline */}
                      <FormField
                        control={form.control}
                        name="deadline"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                              <Clock className="w-5 h-5 text-orange-500" />
                              Deadline
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "h-16 w-full justify-start text-left font-medium text-lg border-2 border-slate-700 rounded-xl hover:bg-black hover:border-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all bg-black text-slate-100",
                                      !field.value && "text-slate-500"
                                    )}
                                  >
                                    <CalendarIcon className="mr-3 h-6 w-6" />
                                    {field.value ? format(field.value, "PPP") : <span>Select deadline</span>}
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0 bg-black border-2 border-slate-700" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                  className="bg-black text-slate-100"
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      {/* Skills */}
                 
                    </div>

                    {/* Action Buttons */}
                    <div className="flex-shrink-0 px-8 py-6 border-t-2 border-slate-700 bg-black">
                      <div className="flex gap-4">
                        <Button
                          type="submit"
                          disabled={isLoading || !form.formState.isValid}
                          className={cn(
                            "flex-1 h-16 text-lg font-semibold rounded-xl transition-all flex items-center justify-center shadow-lg border-2",
                            form.formState.isValid
                              ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white border-emerald-500 hover:border-emerald-400 shadow-emerald-500/25 hover:shadow-emerald-500/40"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed border-slate-700"
                          )}
                        >
                          {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                          {isLoading ? "Creating Bounty..." : "Create Bounty"}
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