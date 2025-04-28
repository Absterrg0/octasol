import { setCodeChefDatabyGithubId, setUsername } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";
import axios from "axios";

export async function processCodechefData(
  githubId: any,
  proofs: any,
  providerName: string
) {
  try {
    let username;

    // Handle different proof structures
    if (Array.isArray(proofs)) {
      const contextData = JSON.parse(proofs[0]?.claimData?.context || '{}');
      username = contextData.extractedParameters?.URL_PARAMS_GRD;
    } else if (proofs.claimData && proofs.claimData.context) {
      const contextData = JSON.parse(proofs.claimData.context);
      username = contextData.extractedParameters?.URL_PARAMS_GRD;
    } else {
      const extractedParams = proofs?.extractedParameters ||
        JSON.parse(proofs?.context || '{}')?.extractedParameters;
      username = extractedParams?.URL_PARAMS_GRD;
    }

    if (!username) {
      throw new Error("Could not extract username from proof");
    }

    const response = await axios.get(
      `https://codechef-api.vercel.app/handle/${username}`
    );

    await setUsername(BigInt(githubId), {
      codechefUsername: username,
    });

    await setCodeChefDatabyGithubId(
      BigInt(githubId),
      response.data.currentRating
    );

    return true;
  } catch (error) {
    await logToDiscord(`processCodechefData: ${(error as any).message}`, "ERROR");

    console.error(
      `Failed to fetch CodeChef data for username`,
      error
    );
    throw new Error("Error fetching CodeChef data");
  }
}
