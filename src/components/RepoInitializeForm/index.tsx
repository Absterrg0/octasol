"use client"

import { useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import cookie from "js-cookie"
import axios from "axios"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Lock, FolderOpen, Github, Rocket, Heart, Plus } from "lucide-react"

// Redux & API
import { setRepositories } from "@/app/Redux/Features/git/repoInitialize"
import { setInstallationId } from "@/app/Redux/Features/git/githubInstallation"
import { clearError, setError } from "@/app/Redux/Features/error/error"
import { POST, GET } from "@/config/axios/requests"
import { getRepo, githubInstallations } from "@/config/axios/Breakpoints"
import { astronautIcon } from "../Svg/svg"
import RepoSearch from "../Input/RepoSearch"
import SelectUser from "../Input/SelectUser"
import { cn } from "@/lib/utils"
import { setIssues } from "@/app/Redux/Features/git/issues"
import { setQuery } from "@/app/Redux/Features/git/search"

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
  )
}

// --- Main Component ---
export default function RepoInitializeForm() {
  const dispatch = useDispatch()
  const user = useSelector((state: any) => state.user)
  const repositories = useSelector((state: any) => state.repo)
  const installationId = useSelector((state: any) => state.installationId)
  console.log(installationId);
  const router = useRouter()
  const selectedRepo = useSelector((state: any) => state.selectedRepo)
  const issues = useSelector((state: any) => state.issues)
  const searchTerm = useSelector((state: any) => state.search.query)

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
      console.log(response);
      dispatch(setRepositories(response.data.repositories || []))
    } catch (error) {
      dispatch(setError((error as any).message))
    }
  }


  const handleRepoSelect = async (repo: Repository, id: bigint) => {
    await POST(`/setSponsorFromGithub`, { userId: id, repo })
    router.push(`/profile/${user?.name}/sponsordashboard`)
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
    else if(installationId){
      fetchRepositories(installationId)
    }
  }, [installationId, user])

  const filteredRepositories = repositories.filter((repo: any) =>
    repo.name.toLowerCase().includes((searchTerm || "").toLowerCase()),
  )

  return (
    <div className="">
      <div className=" mx-auto px-2 py-8 w-full">
        <div className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Repository Dashboard</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Select a repository to view its details and issues.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mt-8">
          {/* Main Content Area */}
          <div className="xl:col-span-8 space-y-6">
            <div className="max-w-2xl w-full mx-auto rounded-2xl overflow-hidden p-6 md:p-10 shadow-2xl bg-gradient-to-br from-white via-slate-50 to-slate-200 dark:from-slate-950 dark:via-black dark:to-black border border-slate-200 dark:border-slate-800">
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
                  <RepoSearch value={searchTerm} onChange={(val) => dispatch(setQuery(val))} />
                </div>
              </div>

              {filteredRepositories.length === 0 ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex flex-col items-center bg-slate-50 dark:bg-slate-900 rounded-xl p-6 shadow border border-slate-200 dark:border-slate-700 w-full ">
                    <div className="mb-4">
                      <Github size={28} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
                      No Repositories Found
                    </h3>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 text-center">
                      Grant access to your repositories or install our GitHub App to get started.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full">
                      <Button
                        onClick={handleInstall}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Install GitHub App
                      </Button>
                      <Button
                        onClick={() => router.push(`/profile/${user?.name}/sponsordashboard`)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-lg"
                      >
                        <Heart className="w-4 h-4 mr-2" />
                        Sponsor Dashboard
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-h-96 flex flex-col overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 dark:bg-black shadow-inner">
                  <Table>
                    <TableBody>
                      {filteredRepositories.map((repo: any) => (
                        <TableRow
                          key={repo.id}
                          className={cn(
                            "flex items-center justify-between w-full transition-all duration-100 hover:bg-neutral-950 group",
                            {
                              "opacity-60 cursor-not-allowed": repo.private === true,
                            },
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
                              variant={"outline"}
                              className={cn(
                                "font-semibold px-4 py-1 rounded-md shadow transition-transform text-xs",
                                "bg-neutral-900 text-neutral-100 border border-neutral-700 hover:bg-neutral-800 hover:text-white focus:ring-2 focus:ring-neutral-700",
                                {
                                  "opacity-60 cursor-not-allowed": repo.private === true,
                                },
                              )}
                              onClick={() => handleRepoSelect(repo, user?.githubId)}
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
          </div>

          <div className="xl:col-span-4 space-y-6">{astronautIcon()}</div>
        </div>
      </div>
    </div>
  )
}
