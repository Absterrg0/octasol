import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getAccessToken } from "@/lib/apiUtils";
import { logToDiscord } from "@/utils/logger";
import { db } from "@/lib/db";

/**
 *
 * @param req NextRequest
 * @returns Next JSON response
 * @note This function required env variables like GITHUB_PRIVATE_KEY_FILE_NAME & GITHUB_APP_ID
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get("installationId");

  if (!installationId) {
    return NextResponse.json(
      { error: "Installation ID is required" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getAccessToken(Number(installationId));

    const reposResponse = await axios.get(
      "https://api.github.com/installation/repositories",
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const sponsorRepos = await db.sponsor.findMany({});
    const sponsorRepoNames = new Set(
      sponsorRepos.map((repo: any) => repo.name)
    );

    // Filter out repositories whose name is present in sponsorRepos
    const filteredRepositories = reposResponse.data.repositories.filter(
      (repo: any) => !sponsorRepoNames.has(repo.full_name)
    );

    return NextResponse.json({ repositories: filteredRepositories });
  } catch (error) {
    await logToDiscord(`github-repos: ${(error as any).message}`, "ERROR");

    console.log(error);

    return NextResponse.json(
      { error: (error as any).message },
      { status: 500 }
    );
  }
}
