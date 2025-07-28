import { getAccessToken } from "@/lib/apiUtils";
import { getBountiesByRepoName, getInstallationId } from "@/utils/dbUtils";
import axios from "axios";




export async function checkPRforLinkedIssue(body:string,repoName:string,installationId:number,pullRequestNumber:number) {
  
    const prBody = body || ''; // Default to an empty string if body is null
  
    const issueLinkRegex = /(?:closes|fixes|resolves)\s+#(\d+)/i;
    const match = prBody.match(issueLinkRegex);
  
    // If no match is found, the PR is not linked in the way we expect.
    if (!match) {
      return;
    }
  
    // Safely extract the issue number. `match[1]` contains the digits captured by `(\d+)`.
    const issueNumber = parseInt(match[1], 10);



    const bounties = await getBountiesByRepoName(repoName)
    const bounty = bounties?.find((bounty: any)=>bounty.issueNumber === issueNumber)
    if(bounty){
        const accessToken = await getAccessToken(installationId)
        // const bountyUrl = `https://octasol.io/bounty/${repoName}/${issueNumber}`
        const commentBody = `## Submission Received!

Your submission is now pending review for the bounty. If it's accepted, the funds will be transferred to an escrow account and released upon completion.

---
### Next Steps for Payout

To ensure a smooth and automatic payout, please complete these one-time steps:

1.  **Sign up on [Octasol.io](https://octasol.io)** with your GitHub account.
2.  **Connect your crypto wallet** in your Octasol.io profile.

This will allow us to transfer the funds directly to your wallet once the work is approved.
`
        const response = await axios.post(`https://api.github.com/repos/${repoName}/issues/${pullRequestNumber}/comments`, {
            body: commentBody
        }, {
            headers: {
                Authorization: `token ${accessToken}`,
                Accept: "application/vnd.github.v3+json",
            },
        });



    }

    
  }