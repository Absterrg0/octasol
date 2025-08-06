import { getAccessToken, getUserByAuthHeader } from "@/lib/apiUtils";
import { getInstallationId, setEscrowedBounty, updateEscrowedBounty } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";




export async function POST(req:NextRequest){

    try{
        const {title,price,description,skills,deadline,contact,issueNumber,repoName} = await req.json();

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

  

        return NextResponse.json({
            msg:"Bounty initialised successfully",
            id:bounty?.id

        },{status:200})
    }
    catch(e){
        console.error(e);
        logToDiscord(`create-bounty/route: ${e}`, "ERROR")  
        return NextResponse.json({
            msg:"Internal server error",

        },{status:500})
    }

}





export async function PUT(req:NextRequest){


    try{

        const {bountyId,pdaEscrow,status,githubId,blockchainTxSignature,payload} = await req.json();
        const installationId = await getInstallationId(BigInt(githubId));




        const bounty = await updateEscrowedBounty(bountyId,{
            status:status,
            escrowPda:pdaEscrow,
            transactionHash:blockchainTxSignature,
            bountyname:payload.title,
            price:payload.price,
            bountyDescription:payload.description,
            skills:payload.skills,
            time:payload.deadline,
            primaryContact:payload.contact,
            issueNumber:payload.issueNumber,
            repoName:payload.repoName
        });

        if(bounty){

            if(status===2){
                const accessToken = await getAccessToken(Number(installationId));
    
                // Bounty comment with contributor instructions
                const commentBody =
                `##  **Bounty** Alert! 💰       
### A **$${bounty.price}** bounty is now available for solving this issue, powered by **[Octasol.io](https://octasol.io)**.
            
---
### How to Get Started
            
1.  **Open a Draft PR:** Fork the repo and open a draft pull request to claim this issue. This is your workspace.
2.  **Link Your PR:** In the PR description, include the line \`Closes #${bounty.issueNumber}\` to link it to this issue.
3.  **Outline Your Plan:** Briefly describe your proposed solution in the PR description so we can provide early feedback.
4.  **Code & Submit:** Push your code to the PR. When you're ready, mark it "Ready for review".            
---
We're excited to see your solution. Happy coding!`;
    
                await axios.post(`https://api.github.com/repos/${bounty.repoName}/issues/${bounty.issueNumber}/comments`, {
                    body: commentBody
                }, {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: "application/vnd.github.v3+json",
                    },
                });
                return NextResponse.json({
                    msg:"Bounty creation successful",
                    id:bounty.id,
                    status:200
                })

            }

        }
        else{
            return NextResponse.json({
                msg:"Bounty update failed",
                status:400
            })
        }
    }
    catch(e){
        console.error(e);
        return NextResponse.json({
            msg:"Internal server error"
        },{
            status:500
        })
    }


}