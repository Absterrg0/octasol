import { NextRequest, NextResponse } from "next/server";
import { getBounty, getBountySubmissionsById } from "@/utils/dbUtils";



export async function GET(req:NextRequest){

    try{
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
        const submissionsRaw = await getBountySubmissionsById(bounty.id);
        if (!submissionsRaw) {
            return NextResponse.json({
                msg: "No submissions found"
            }, { status: 404 });
        }
        const submissions = submissionsRaw.map((submission: any) => ({
            ...submission,
            githubId: Number(submission.githubId)
        }));
        console.log(submissions);
        return NextResponse.json({submissions});
    }
    catch(e){
        console.error(e);
        return NextResponse.json({
            msg:"Internal server error",
        },{
            status:500
        })
    }
}