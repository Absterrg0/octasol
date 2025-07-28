import { Button } from "@/components/ui/button"
import { ExternalLink, Plus, Shield } from "lucide-react"
import {  BountyDialog } from "./BountyDialog"
import { useState } from "react"
import type { Issue } from "@/app/Redux/Features/git/issues"
import { useSelector } from "react-redux"



export function IssueActionButtons({ 
  issue, 

}:{issue:Issue}) {
    const [bountyDialogOpen, setBountyDialogOpen] = useState(false);
    const selectedRepo = useSelector((state:any)=>state.selectedRepo);
 
    const handleCreateEscrow = ()=>{

    }
    const handleViewPR = () => {
        const url = `https://github.com/${selectedRepo.full_name}/issues/${issue.number}`;
    
        window.open(url, "_blank", "noopener,noreferrer");
    }
  
  const renderButtons = () => {
    switch (issue.status) {
      case "NORMAL":
        return (
          <Button   
            variant="outline"
            size="sm"
            onClick={()=>setBountyDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus size={16} />
            Create Bounty
          </Button>
        )
      
      case "BOUNTY_INIT":
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={()=>setBountyDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Shield size={16} />
              Create Escrow
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleViewPR}
              className="flex items-center gap-2"
            >
              <ExternalLink size={16} />
              View PR
            </Button>
          </div>
        )
      
      case "ESCROW_INIT":
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={()=>setBountyDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <ExternalLink size={16} />
            View PR
          </Button>
        )
      
      default:
        return null
    }
  }

  return <div className="flex justify-end">{renderButtons()}
     {/* Bounty Dialog */}
     <BountyDialog
        open={bountyDialogOpen}
        onOpenChange={setBountyDialogOpen}
        issue={issue}
      />
  </div>
}

// Status Badge Component
export function IssueStatusBadge({ status }: { status: "NORMAL" | "BOUNTY_INIT" | "ESCROW_INIT" }) {
  const getStatusConfig = () => {
    switch (status) {
      case "NORMAL":
        return {
          label: "Normal",
          className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
        }
      case "BOUNTY_INIT":
        return {
          label: "Bounty Active",
          className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
        }
      case "ESCROW_INIT":
        return {
          label: "Escrow Active",
          className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
        }
      default:
        return {
          label: "Unknown",
          className: "bg-gray-100 text-gray-800"
        }
    }
  }

  const config = getStatusConfig()
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}