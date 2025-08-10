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
                `## 🚨 Bounty Opportunity! 💰

A **$${bounty.price}** bounty is up for grabs on this issue, brought to you by **[Octasol.io](https://octasol.io)**.

---

### How to Participate

1. **Claim the Issue:** Open a draft PR(Pull Request) on this issue.
2. **Reference the Issue:** Add \`Closes #${bounty.issueNumber}\` in your PR description to automatically link your PR to this issue(IF NOT LINKED, SUBMISSION WILL BE REJECTED).
3. **Share Your Approach:** Briefly outline your proposed solution in the PR description for early feedback from maintainers.
4. **Share the wallet address:** Share your wallet address in the PR description as Address: <wallet_address>
5. **Wait for result:** Wait for the maintainer to review your approach. If accepted, you can start to make the changes for the issue and work on the bounty.

---

We look forward to your contribution. Good luck and happy coding!`;
    
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