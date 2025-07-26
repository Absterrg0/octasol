import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/apiUtils";
import axios from "axios";

interface RequestData {
  repo: string;
  installationId: number;
}

export async function POST(req: NextRequest) {
  const data: RequestData = await req.json();
  const repoName: String = data.repo;
  const installationId: number = data.installationId;

  if (!repoName) {
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

  const accessToken = await getAccessToken(installationId);


  const issuesResponse = await axios.get(
    `https://api.github.com/repos/${repoName}/issues`,
    {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );


  
  return NextResponse.json(issuesResponse.data || []);
}
