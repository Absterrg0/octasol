"use client"

import { useEffect, useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import cookie from "js-cookie"
import axios from "axios"
import { formatDistanceToNow } from "date-fns"

// UI Components & Icons
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  ExternalLink,
  RefreshCw,
  Lock,
  FolderOpen,
  CheckCircle2,
  Star,
  GitFork,
  Code2,
  History,
  Github,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

// Redux & API
import { setRepositories, setSelectedRepo } from "@/app/Redux/Features/git/repoInitialize"
import { setInstallationId } from "@/app/Redux/Features/git/githubInstallation"
import { clearError, setError } from "@/app/Redux/Features/error/error"
import { POST } from "@/config/axios/requests"
import { getRepo, githubInstallations } from "@/config/axios/Breakpoints"
import { astronautIcon} from "../Svg/svg"
import RepoSearch from "../Input/RepoSearch"
import SelectUser from "../Input/SelectUser"
import { cn } from "@/lib/utils"
import { IssuesCard } from "./issue-table";
import { RepoSelectionCard } from "./repo-selection-card";
import { RepoDetailsCard } from "./repo-details-card";
import { setIssues } from "@/app/Redux/Features/git/issues";
import { setQuery } from "@/app/Redux/Features/git/search";
import type { Issue } from "@/app/Redux/Features/git/issues"
// --- Interfaces ---


export interface Repository {
  id: number
  name: string
  full_name: string
  private: boolean
  description?: string
  html_url: string
  stargazers_count: number
  forks_count: number
  language?: string
  updated_at: string
  open_issues_count: number
}

export const ISSUES_PER_PAGE = 10



const BottomGradient = () => {
  return (
    <>
      <span className="opacity-100 block transition duration-500  absolute h-px w-full -bottom-px inset-x-0 bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <span className="opacity-100 blur-sm block transition duration-500  absolute h-px w-1/2 mx-auto -bottom-px inset-x-10 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
    </>
  );
};
// --- Main Component ---
export default function RepoInitializeForm() {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.user)
  const repositories = useSelector((state: any) => state.repo)
  const installationId = useSelector((state: any) => state.installationId)
  const router = useRouter()

  const selectedRepo = useSelector((state: any) => state.selectedRepo);
  const issues = useSelector((state: any) => state.issues);
  const searchTerm = useSelector((state: any) => state.search.query);

  const dispatchInstallationId = async (forceRefresh = false) => {
    if (user) {
      const { response, error } = await POST(githubInstallations, { githubId: user?.githubId })
      if (response?.data?.installationId) {
        const id = response.data.installationId
        dispatch(setInstallationId(id))
        localStorage.setItem("installationId", id)
        await fetchRepositories(id)
      } else {
        console.error(error)
        dispatch(setError("Failed to fetch GitHub installation."))
      }
    }
  }

  const fetchRepositories = async (id: string) => {
    try {
      dispatch(clearError())
      const response = await axios.get(`/api/github-repos?installationId=${id}`)
      dispatch(setRepositories(response.data.repositories || []))
    } catch (error) {
      dispatch(setError((error as any).message))
    }
  }

  const fetchIssues = async (repo: Repository) => {
    if (!installationId) return
    try {
      const response = await POST(getRepo, { repo: repo.name, installationId })
      dispatch(setIssues(response?.response?.data || []))
    } catch (error) {
      console.error("Failed to fetch issues:", error)
      dispatch(setIssues([]))
    }
  }

  const handleRepoSelect = (repoId: string) => {
    const repo = repositories.find((r: Repository) => r.id.toString() === repoId)
    if (repo) {
      dispatch(setSelectedRepo(repo))
      dispatch(setIssues([]))
      fetchIssues(repo)
    }
  }

  const handleInstall = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? ""
    const redirectUri = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALLATION_CALLBACK_URL ?? ""
    const state = uuidv4()
    cookie.set("oauth_state", state, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    })
    const installUrl = `https://github.com/apps/osol-feat-app-dev/installations/new?state=${state}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    router.push(installUrl)
  }

  useEffect(() => {
    if (user && !installationId) {
      dispatchInstallationId()
    }   
  }, [installationId, user, dispatch])

  return (
    <div className="min-h-screen">
      <div className=" mx-auto px-4 py-8 w-full">
        <Header />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-8">
          {/* Main Content Area */}
          <div className="xl:col-span-8 space-y-6">

        {!selectedRepo ? (
          
          <div className="max-w-2xl w-full mx-auto rounded-2xl p-6 md:p-10 shadow-2xl bg-gradient-to-br from-white via-slate-50 to-slate-200 dark:from-slate-950 dark:via-black dark:to-black border border-slate-200 dark:border-slate-800">
            <div className="relative flex flex-col items-center mb-6">
            
              <h2 className="font-extrabold text-2xl md:text-3xl text-neutral-900 dark:text-neutral-100 text-center tracking-tight">
                Select a GitHub Repository
              </h2>
              <p className="text-base text-neutral-500 dark:text-neutral-400 text-center mt-2 pb-2">
                Choose a repository to import and start managing your issues.
              </p>
              <BottomGradient />
            </div>

            <div className="my-8 flex flex-col md:flex-row gap-4 items-center w-full justify-center">
              <div className="w-full md:w-1/2">
                <SelectUser data={user?.name} />
              </div>
              <div className="w-full md:w-1/2">
                <RepoSearch value={searchTerm} onChange={val => dispatch(setQuery(val))} />
              </div>
            </div>

            {repositories.filter((repo: any) =>
              repo.name.toLowerCase().includes((searchTerm || "").toLowerCase())
            ).length === 0 ? (
              <div className="flex flex-col justify-center items-center gap-6">
                <div className="flex flex-col items-center">
                  <AlertCircle size={32} className="text-slate-400 mb-2" />
                  <p className="text-lg font-medium text-neutral-500 dark:text-neutral-400">
                    No repositories found
                  </p>
                  <p className="text-sm text-neutral-400 dark:text-neutral-500">
                    You may need to add or grant access to your repositories.
                  </p>
                </div>
               
              </div>
            ) : (
              <div className="max-h-96 flex flex-col overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 dark:bg-black shadow-inner">
                <Table>
                  <TableBody>
                    {repositories
                      .filter((repo: any) =>
                        repo.name.toLowerCase().includes((searchTerm || "").toLowerCase())
                      )
                      .map((repo: any) => (
                        <TableRow
                          key={repo.id}
                          className={cn(
                            "flex items-center justify-between w-full transition-all duration-100 hover:bg-neutral-950 group",
                            {
                              "opacity-60 cursor-not-allowed": repo.private === true,
                            }
                          )}
                        >
                          <TableCell className="flex items-center gap-3 font-medium text-base">
                            <FolderOpen size={18} className="text-blue-500 dark:text-blue-400" />
                            <span className="">{repo.full_name.split("/")[1]}</span>
                            {repo.private && (
                              <span className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-semibold">
                                <Lock size={12} />
                                Private
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={'outline'}
                              className={cn(
                                "font-semibold px-4 py-1 rounded-md shadow transition-transform text-xs",
                                "bg-neutral-900 text-neutral-100 border border-neutral-700 hover:bg-neutral-800 hover:text-white focus:ring-2 focus:ring-neutral-700",
                                {
                                  "opacity-60 cursor-not-allowed": repo.private === true,
                                }
                              )}
                              onClick={() => handleRepoSelect(repo.id.toString())}
                              disabled={repo.private === true}
                            >
                              Import
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                <div className="text-center py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 rounded-b-lg">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Missing a repository?{" "}
                    <button
                      onClick={handleInstall}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium transition-colors"
                    >
                      Install GitHub App
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        ):(

          <IssuesCard
            selectedRepo={selectedRepo}
            issues={issues}
            onRefresh={fetchIssues}
          />
        )}

          </div>


          <div className="xl:col-span-4 space-y-6">
            {!selectedRepo ? (
              astronautIcon()
            ):(
               <div className="sticky top-8 space-y-6">
               <RepoSelectionCard
                 repositories={repositories}
                 selectedRepo={selectedRepo}
                 onRepoSelect={handleRepoSelect}
                 onInstall={handleInstall}
                 onRefresh={() => dispatchInstallationId(true)}
               />
 
               {selectedRepo && (
                 <>
                   <RepoDetailsCard repo={selectedRepo} />
                 </>
               )}
             </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---
const Header = () => (
  <div className="text-center space-y-4 py-8">
    <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Repository Dashboard</h1>
    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
      Select a repository to view its details and issues.
    </p>
  </div>
)






