import { getAccessToken, getUserByAuthHeader } from "@/lib/apiUtils";
import { getInstallationId, setEscrowedBounty } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";




export async function POST(req:NextRequest){

    try{
        const {title,price,description,skills,deadline,contact,issueNumber,repoName,githubId} = await req.json();
        const installationId = await getInstallationId(BigInt(githubId));


        const bounty = await setEscrowedBounty({
            bountyname:title,
            price:price,
            bountyDescription:description,
            skills:skills,
            time:deadline,
            primaryContact:contact,
            issueNumber:issueNumber,
            repoName:repoName   
        })

        const bountyUrl = `https://octasol.io/bounty/${repoName}/${issueNumber}`;
 

        if(bounty){
            const accessToken = await getAccessToken(Number(installationId));
    
            // Bounty comment with contributor instructions
            const commentBody =
            `##  **Bounty** Alert! 💰
            
### A **$${price}** bounty is now available for solving this issue, powered by **[Octasol.io](https://octasol.io)**.
            
---
### How to Get Started
            
1.  **Open a Draft PR:** Fork the repo and open a draft pull request to claim this issue. This is your workspace.
2.  **Link Your PR:** In the PR description, include the line \`Closes #${issueNumber}\` to link it to this issue.
3.  **Outline Your Plan:** Briefly describe your proposed solution in the PR description so we can provide early feedback.
4.  **Code & Submit:** Push your code to the PR. When you're ready, mark it "Ready for review".            
---
We're excited to see your solution. Happy coding!`;

            await axios.post(`https://api.github.com/repos/${repoName}/issues/${issueNumber}/comments`, {
                body: commentBody
            }, {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/vnd.github.v3+json",
                },
            });
            return NextResponse.json({
                msg:"Bounty creation successful",
                status:200
            })
        }
        else{
            return NextResponse.json({
                msg:"Bounty creation failed",
                status:400
            })
        }
    }
    catch(e){
        console.log(e);
        logToDiscord(`create-bounty/route: ${e}`, "ERROR")  
        return NextResponse.json({
            msg:"Internal server error",

        },{status:500})
    }

}

