'use client'
import { IssuesCard } from "@/components/RepoInitializeForm/issue-table";
import { RepoDetailsCard } from "@/components/RepoInitializeForm/repo-details-card";

import { GET } from "@/config/axios/requests";
import { getRepo } from "@/config/axios/Breakpoints";
import { setIssues } from "@/app/Redux/Features/git/issues";
import { useDispatch } from "react-redux";
import { useSelector } from "react-redux";
import { useParams } from "next/navigation";
import { setSelectedRepo } from "@/app/Redux/Features/git/repoInitialize";
import { useEffect } from "react";
import { setInstallationId } from "@/app/Redux/Features/git/githubInstallation";
import { POST } from "@/config/axios/requests";
import { githubInstallations } from "@/config/axios/Breakpoints";
import { setError } from "@/app/Redux/Features/error/error";



export default function EscrowPage() {
    const dispatch = useDispatch();
    const installationId = useSelector((state: any) => state.installationId)
    const sponsorId = useParams().sponsorId
    const user = useSelector((state:any)=>state.user)
    const issues = useSelector((state:any)=>state.issues);
    const selectedRepo = useSelector((state: any) => state.selectedRepo)



    const dispatchInstallationId = async (forceRefresh = false) => {
        if (user) {
          const { response, error } = await POST(githubInstallations, { githubId: user?.githubId })
          if (response?.data?.installationId) {
            const id = response.data.installationId
            dispatch(setInstallationId(id))
            localStorage.setItem("installationId", id)
            await fetchIssues(id)
          } else {
            console.error(error)
            dispatch(setError("Failed to fetch GitHub installation."))
          }
        }
      }
    const fetchIssues = async (installId:string) => {


        if (!installId) return
        try {
          const response = await GET(`${getRepo}?id=${sponsorId}&installationId=${installId}`)  
          dispatch(setSelectedRepo(response.repo || []))
          dispatch(setIssues(response.issues || []))
        } catch (error) {
          console.error("Failed to fetch issues:", error)
          dispatch(setIssues([]))
        }
      }

      useEffect(() => {
        if (user && !installationId) {
          dispatchInstallationId()
        }
        else if(installationId){
            fetchIssues(installationId);
        }
      }, [installationId, user, sponsorId]) // removed `dispatch` — it's stable and doesn't need to be here
      
  return (
    <div className="flex flex-col lg:flex-row ">
      {/* Left: Issues Card */}
      <div className="flex-1 mt-8 min-w-0 px-4">
        <IssuesCard
          selectedRepo={selectedRepo}
          issues={issues}
          onRefresh={() => fetchIssues(installationId)}
        />
      </div>
      {/* Right: Repo Details Card */}
      <div className="w-full px-4 lg:w-[350px] flex-shrink-0">
        <div className="sticky top-8 space-y-6">
          {selectedRepo && (
            <RepoDetailsCard repo={selectedRepo} />
          )}
        </div>
      </div>
    </div>
  );
}