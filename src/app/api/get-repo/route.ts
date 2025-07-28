import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/apiUtils";
import axios from "axios";
import { getBountiesByRepoName } from "@/utils/dbUtils";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;

    const repo = searchParams.get("repo");
    const installationId = searchParams.get("installationId");
    console.log(repo);
    if (!repo) {
      return NextResponse.json(
        { error: "Repository name is required" },
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

    const issuesResponse = await axios.get(
      `https://api.github.com/repos/${repo}/issues`,
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const bounties = await getBountiesByRepoName(repo);


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
    
    return NextResponse.json(issuesWithStatus || []);
  }
  catch(e){
    console.error(e);

    return NextResponse.json({
      msg:"Internal server error",
    },{status:500})
  }
}