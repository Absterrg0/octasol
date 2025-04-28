import { getHackerrankProfileByApi } from "@/lib/apiUtils";
import { setHackerrankDatabyGithubId, setUsername } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";

export async function processHackerRankData(
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
      hackerrankUsername: username,
    });

    const { currentPoints, stars } = await getHackerrankStats(username);
    await setHackerrankDatabyGithubId(BigInt(githubId), currentPoints, stars);

    return true;
  } catch (error) {
    await logToDiscord(`processHackerRankData: ${(error as any).message}`, "ERROR");
    console.error("Error processing HackerRank proof:", error);
    return false;
  }
}

export async function getHackerrankStats(username: string) {
  try {
    const data = await getHackerrankProfileByApi(username);
    let stars = 0;
    let currentPoints = 0;
    data.models.forEach((model: any) => {
      currentPoints += model.current_points;
      stars += model.stars;
    });
    return { currentPoints, stars };
  } catch (error) {
    await logToDiscord(`getHackerrankStats: ${(error as any).message}`, "ERROR");

    console.error("Error fetching Hackerrank stats:", error);
    return { currentPoints: 0, stars: 0 };
  }
}
