import { NextRequest, NextResponse } from "next/server";
import { getInstallationId, setUser } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";
import { getInstallationIdbyGithubId } from "@/lib/apiUtils";

interface RequestData {
  githubId: number;
}

export async function POST(req: NextRequest) {
  try {
    const data: RequestData = await req.json();
    const githubId: number = data.githubId;
    // 1) Try DB first
    let installationId = await getInstallationId(BigInt(githubId));

    // 2) If not present, fetch from GitHub API and persist
    if (!installationId || Number(installationId) === 0) {
      const ghInstallationId = await getInstallationIdbyGithubId(githubId);
      if (ghInstallationId && ghInstallationId !== 0) {
        await setUser(BigInt(githubId), ghInstallationId);
        installationId = BigInt(ghInstallationId);
      }
    }

    return NextResponse.json({ installationId: Number(installationId || 0) });
  } catch (error) {
    await logToDiscord(`github-installation-id ${(error as any).message}`, "ERROR");

    return NextResponse.json(
      { error: (error as any).message },
      { status: 500 }
    );
  }
}
