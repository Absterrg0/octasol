import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBounty, getWinnerBountySubmission } from "@/utils/dbUtils";

export async function GET(req: NextRequest) {
    try {
        // Retrieve bountyId from the URL's query parameters
        const searchParams = req.nextUrl.searchParams;
        const issueNumber = searchParams.get("issueNumber");
        const repoName = searchParams.get("repoName");

        if(!issueNumber || !repoName){
            return NextResponse.json({
                msg:"Invalid inputs"
            },{status:400});
        }
        const bounty = await getBounty(Number(issueNumber),repoName);
        if(!bounty){
            return NextResponse.json({
                msg:"Bounty not found"
            },{status:404});
        }
        const winningSubmissionRaw = await getWinnerBountySubmission(bounty.id);
        
        // If no winning submission is found, return a 404 Not Found error
        if (!winningSubmissionRaw) {
            return NextResponse.json({
                msg: "Winning submission not found for this bounty"
            }, {
                status: 404
            });
        }

        // Convert the BigInt githubId to a Number for JSON serialization
        const winningSubmission = {
            ...winningSubmissionRaw,
            githubId: Number(winningSubmissionRaw.githubId),
        };

        // Return the winning submission
        return NextResponse.json({winningSubmission}, {
            status: 200
        });

    } catch (e) {
        console.error("Error in GET /get-winning-submission:", e);
        return NextResponse.json({
            msg: "Internal server error"
        }, {
            status: 500
        });
    }
}
