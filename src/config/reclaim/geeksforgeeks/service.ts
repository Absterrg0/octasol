import { setGFGDatabyGithubId, setUsername } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";

export async function processGeeksForGeeksData(
  githubId: any,
  proofs: any,
  providerName: string
) {
  try {
    let username, score, problemsSolved;

    // Handle different proof structures
    if (Array.isArray(proofs)) {
      const contextData = JSON.parse(proofs[0]?.claimData?.context || '{}');
      username = contextData.extractedParameters?.URL_PARAMS_1;
      score = parseInt(contextData.extractedParameters?.score);
      problemsSolved = parseInt(contextData.extractedParameters?.total_problems_solved);
    } else if (proofs.claimData && proofs.claimData.context) {
      const contextData = JSON.parse(proofs.claimData.context);
      username = contextData.extractedParameters?.URL_PARAMS_1;
      score = parseInt(contextData.extractedParameters?.score);
      problemsSolved = parseInt(contextData.extractedParameters?.total_problems_solved);
    } else {
      const extractedParams = proofs?.extractedParameters ||
        JSON.parse(proofs?.context || '{}')?.extractedParameters;
      username = extractedParams?.URL_PARAMS_1;
      score = parseInt(extractedParams?.score);
      problemsSolved = parseInt(extractedParams?.total_problems_solved);
    }

    if (!username) {
      throw new Error("Could not extract username from proof");
    }

    await setUsername(BigInt(githubId), {
      gfgUsername: username,
    });

    await setGFGDatabyGithubId(BigInt(githubId), score, problemsSolved);

    return true;
  } catch (error) {
    await logToDiscord(`processGeeksForGeeksData: ${(error as any).message}`, "ERROR");
    console.error("Error processing GeeksForGeeks proof:", error);
    return false;
  }
}
