import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/apiUtils";
import axios from "axios";
import { getBountiesByRepoName } from "@/utils/dbUtils";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const installationId = searchParams.get("installationId");
    const id = Number(searchParams.get("id"));

    const sponsor = await db.sponsor.findUnique({
      where: {
        id:id,
      },
    })

    if (!sponsor) {
      return NextResponse.json(
        { error: "Sponsor is required" },
        { status: 400 }
      );
    }

    if (!installationId) {
      return NextResponse.json(
        { error: "Installation ID is required" },
        { status: 400 }
      );
    }

 


    const accessToken = await getAccessToken(installationId as unknown as number);

    const reposResponse = await axios.get(
      `https://api.github.com/repos/${sponsor?.name}`,
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )
    const repo = reposResponse.data;

    const issuesResponse = await axios.get(
      `https://api.github.com/repos/${repo.full_name}/issues`,
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const bounties = await getBountiesByRepoName(repo.full_name);


    // Create a map of issue numbers to their bounty data for easy lookup
    const bountyMap = new Map();
    bounties?.forEach((bounty: any) => {
      bountyMap.set(bounty.issueNumber, bounty);
    });


    const issuesOnly = issuesResponse.data.filter((item: any)=>!item.pull_request);
    // Add a "status" key to each issue based on bounty and submission status
    const issuesWithStatus = issuesOnly.map((issue: any) => {
      const bounty = bountyMap.get(issue.number);
      
      let status = "NORMAL";
      
      if (bounty) {
        // Check if any submission has status 2 (is winner)
        const hasWinnerSubmission = bounty.submissions?.some((submission: any) => submission.status === 2);
        
        if (hasWinnerSubmission) {
          status = "ESCROW_INIT";
        } else {
          status = "BOUNTY_INIT";
        }
      }
      
      return {
        ...issue,
        status
      };
    });


    // console.log(issuesWithStatus);
    
    return NextResponse.json({
      issues:issuesWithStatus,
      repo:repo
    });
  }
  catch(e){
    console.error(e);

    return NextResponse.json({
      msg:"Internal server error",
    },{status:500})
  }
}