import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Calendar, Plus, Shield, ExternalLink, RefreshCw, AlertCircle, CheckCircle2, FolderOpen } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ISSUES_PER_PAGE } from "./index"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/components/ui/pagination"
import type { Issue } from "@/app/Redux/Features/git/issues"
import { useState } from "react"
import React from "react"
import { IssueActionButtons,IssueStatusBadge } from "./issueStatusButton"
import { BountyDialog } from "./BountyDialog"
import EscrowDialog from "./EscrowDialog"



export const IssuesCard = ({ 
    selectedRepo, 
    issues, 
    onRefresh
  }: any) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
    
    const totalIssues = issues.length;
    const totalPages = Math.ceil(totalIssues / ISSUES_PER_PAGE);
    const startIndex = (currentPage - 1) * ISSUES_PER_PAGE;
    const endIndex = startIndex + ISSUES_PER_PAGE;
    const currentIssues = issues.slice(startIndex, endIndex);
    
    const handlePageChange = (page: number) => setCurrentPage(page);
    const handlePrevPage = () => setCurrentPage((prev: number) => Math.max(1, prev - 1));
    const handleNextPage = () => setCurrentPage((prev: number) => Math.min(totalPages, prev + 1));
    
 
    
    const formatDate = (dateString: string) =>
      new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
  
    return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Repository Issues
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                {selectedRepo
                  ? `Viewing ${totalIssues} issues for ${selectedRepo.name}`
                  : "Select a repository to view its issues"}
              </CardDescription>
            </div>
            {selectedRepo && (
              <Button variant="outline" size="icon" onClick={() => onRefresh(selectedRepo)}>
                <RefreshCw className={`w-4 h-4`} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!selectedRepo ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
                <FolderOpen className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Select a Repository</h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Choose a repository from the sidebar to view its issues and activity.
              </p>
            </div>
          ) : totalIssues === 0 ? (
            <div className="text-center py-24">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">No Issues Found</h3>
              <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                This repository has no open or closed issues. Great job maintaining a clean codebase!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <TableHead className="w-[320px] font-semibold text-slate-700 dark:text-slate-300">Issue</TableHead>
                    <TableHead className="w-[110px] font-semibold text-slate-700 dark:text-slate-300">Status</TableHead>
                    <TableHead className="w-[160px] font-semibold text-slate-700 dark:text-slate-300">Author</TableHead>
                    <TableHead className="w-[140px] font-semibold text-slate-700 dark:text-slate-300">Created</TableHead>
                    <TableHead className="w-[180px] text-center font-semibold text-slate-700 dark:text-slate-300">Actions</TableHead>
                    <TableHead className="w-[48px] text-right font-semibold text-slate-700 dark:text-slate-300"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {
                    currentIssues.map((issue: Issue & { status: "NORMAL" | "BOUNTY_INIT" | "ESCROW_INIT" }) => (
                      <TableRow
                        key={issue.id}
                        className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <TableCell className="font-medium max-w-[320px] w-[320px] align-middle">
                          <div className="flex flex-col gap-1">
                            <span className="line-clamp-2 text-slate-900 dark:text-slate-100 leading-snug">{issue.title}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded w-fit">
                              #{issue.number}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="w-[110px] align-middle">
                          <Badge variant="default" className="text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50">
                            {issue.state}
                          </Badge>
                        </TableCell>
                  
                        <TableCell className="w-[160px] align-middle">
                          <div className="flex items-center gap-2">
                            <img
                              src={issue.user.avatar_url || "/placeholder.svg"}
                              alt={issue.user.login}
                              className="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="w-[120px] align-middle">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(issue.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="w-[180px] align-middle text-center">
                          {issue.status === "NORMAL" && (
                            <BountyDialog issue ={issue}></BountyDialog>
                          )}
                          {issue.status === "BOUNTY_INIT" && (
                            <EscrowDialog
                            issue = {issue}
                            ></EscrowDialog>
                          )}
                          {issue.status === "ESCROW_INIT" && (
                            <Badge variant="default" className="text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50">
                              Escrow Locked
                            </Badge>
                          )}
                          
                        </TableCell>
                        <TableCell className="w-[48px] align-middle text-right">
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 p-0">
                            <a href={issue.html_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            </div>
          )}
          {selectedRepo && totalIssues > 0 && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={currentPage > 1 ? handlePrevPage : undefined}
                      aria-disabled={currentPage === 1}
                      tabIndex={currentPage === 1 ? -1 : 0}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  {(() => {
                    const pages = [];
                    const maxVisiblePages = 5;
                    let start = Math.max(1, currentPage - 2);
                    let end = Math.min(totalPages, start + maxVisiblePages - 1);
                    if (end - start < maxVisiblePages - 1) {
                      start = Math.max(1, end - maxVisiblePages + 1);
                    }
                    // Show first page and ellipsis if needed
                    if (start > 1) {
                      pages.push(
                        <PaginationItem key={1}>
                          <PaginationLink isActive={currentPage === 1} onClick={() => handlePageChange(1)} href="#">1</PaginationLink>
                        </PaginationItem>
                      );
                      if (start > 2) {
                        pages.push(
                          <PaginationItem key="start-ellipsis">
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                    }
                    for (let i = start; i <= end; i++) {
                      if (i === 1 || i === totalPages) continue; // already handled
                      pages.push(
                        <PaginationItem key={i}>
                          <PaginationLink isActive={currentPage === i} onClick={() => handlePageChange(i)} href="#">{i}</PaginationLink>
                        </PaginationItem>
                      );
                    }
                    // Show last page and ellipsis if needed
                    if (end < totalPages) {
                      if (end < totalPages - 1) {
                        pages.push(
                          <PaginationItem key="end-ellipsis">
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      pages.push(
                        <PaginationItem key={totalPages}>
                          <PaginationLink isActive={currentPage === totalPages} onClick={() => handlePageChange(totalPages)} href="#">{totalPages}</PaginationLink>
                        </PaginationItem>
                      );
                    }
                    return pages;
                  })()}
                  <PaginationItem>
                    <PaginationNext
                      onClick={currentPage < totalPages ? handleNextPage : undefined}
                      aria-disabled={currentPage === totalPages}
                      tabIndex={currentPage === totalPages ? -1 : 0}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
      
   
    </>
  )
  }