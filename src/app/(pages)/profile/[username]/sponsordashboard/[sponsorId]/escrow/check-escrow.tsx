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
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "react-toastify";
import { GET } from "@/config/axios/requests"; // Assuming GET is a helper for fetch
import { useSelector } from "react-redux";

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
        description: "Selected as winner"
      };
    case 3:
        return { 
          label: "Rejected", 
          icon: XCircle, 
          variant: "destructive" as const,
          description: "Not selected"
        };
    default:
      return { 
        label: "Locked", 
        icon: Lock, 
        variant: "default" as const,
        description: "Submission is locked in"
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
  const { connected } = useWallet();
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


  // Handle dialog open state change
  const handleOpenChange = (isOpen: boolean) => {
    setDialogOpen(isOpen);
    fetchWinningSubmission();
  };
  
  // Placeholder for onCancelBounty and isCancelling
  const onCancelBounty = () => {
    toast.info("Cancel bounty functionality not implemented yet.");
  };

  const isCancelling = false;

  if (loading) {
    return (
      <Dialog onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 text-primary">
            <Lock className="w-4 h-4" />
            View Locked Submission
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading winning submission...</p>
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
          <Button variant="outline" className="gap-2 text-primary">
            <Lock className="w-4 h-4" />
            View Locked Submission
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <div className="text-center py-12 space-y-4">
            <div className="p-4 bg-muted/30 rounded-full w-fit mx-auto">
              <AlertCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium text-lg">No winning submission found</h3>
              <p className="text-sm text-muted-foreground">
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
        <Button variant="outline" className="gap-2 text-primary">
          <Lock className="w-4 h-4" />
          View Locked Submission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Lock className="w-5 h-5" />
            </div>
            Locked Bounty Details
          </DialogTitle>
          <DialogDescription className="text-base">
            This bounty has a winning submission locked in. You can review the details or cancel the bounty if needed.
          </DialogDescription>
        </DialogHeader>

        {/* Bounty Overview */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 rounded-xl p-6 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                <DollarSign className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                    ${winningSubmission.bounty.price}
                  </span>
                  <span className="text-sm text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/50 px-2 py-1 rounded-full">
                    USDC
                  </span>
                </div>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">Total Bounty Amount</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Created {formatDate(winningSubmission.bounty.createdAt)}
              </div>
              {winningSubmission.bounty.skills && winningSubmission.bounty.skills.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {winningSubmission.bounty.skills.slice(0, 3).map((skill: string, index: number) => (
                    <Badge key={index} variant="default" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {winningSubmission.bounty.skills.length > 3 && (
                    <Badge variant="default" className="text-xs">
                      +{winningSubmission.bounty.skills.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Single Locked Submission */}
        <div className="space-y-4">
          <Card className="transition-all hover:shadow-md border-l-4 border-l-yellow-400">
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
                        <span className="font-medium">Winning Submission</span>
                        <Badge variant="default" className="gap-1 bg-yellow-500 hover:bg-yellow-600">
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
                      {formatDate(winningSubmission.createdAt)}
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
                        {formatWalletAddress(winningSubmission.walletAddress || "")}
                      </code>
                    </div>
                  </div>

                  {/* PR Link */}
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Pull Request</p>
                      {winningSubmission.links && winningSubmission.links.length > 0 ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => window.open(winningSubmission.links[0], "_blank")}
                        >
                          View PR #{winningSubmission.githubPRNumber || 'N/A'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No PR link</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {winningSubmission.notes && (
                  <div className="p-3 bg-muted/20 rounded-lg">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{winningSubmission.notes}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={onCancelBounty}
            disabled={isCancelling || !connected}
            className="gap-2"
          >
            {isCancelling ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
      </DialogContent>
    </Dialog>
  );
}
