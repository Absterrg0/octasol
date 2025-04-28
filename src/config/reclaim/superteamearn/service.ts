import { scrapeSuperteamStats } from "./scraper";
import { setUsername, setSuperteamEarnDatabyGithubId } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";

export async function processSuperteamEarnData(
  githubId: any,
  proofs: any,
  providerName: string
) {
  try {
    let username;

    // Handle different proof structures
    if (Array.isArray(proofs)) {
      const contextData = JSON.parse(proofs[0]?.claimData?.context || '{}');
      username = contextData.extractedParameters?.username;
    } else if (proofs.claimData && proofs.claimData.context) {
      const contextData = JSON.parse(proofs.claimData.context);
      username = contextData.extractedParameters?.username;
    } else {
      const extractedParams = proofs?.extractedParameters ||
        JSON.parse(proofs?.context || '{}')?.extractedParameters;
      username = extractedParams?.username;
    }

    if (!username) {
      throw new Error("Could not extract username from proof");
    }

    await setUsername(githubId, {
      superteamUsername: username,
    });

    const stats = await scrapeSuperteamStats(username);

    if (stats) {
      await setSuperteamEarnDatabyGithubId(
        githubId,
        stats.participations,
        stats.wins,
        stats.totalWinnings
      );
    }

    return true;
  } catch (error) {
    await logToDiscord(`processSuperteamEarnData: ${(error as any).message}`, "ERROR");
    console.error("Error processing SuperteamEarn proof:", error);
    return false;
  }
}
