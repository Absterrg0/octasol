import { QuestionData } from "@/lib/types";
import { setUsername, setLeetCodeDatabyGithubId } from "@/utils/dbUtils";
import { logToDiscord } from "@/utils/logger";

export async function processLeetcodeData(
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

    // Save the username
    await setUsername(githubId, {
      leetcodeUsername: username,
    });

    const query = `
      query userProfileUserQuestionProgressV2($userSlug: String!) {
        userProfileUserQuestionProgressV2(userSlug: $userSlug) {
          numAcceptedQuestions {
            count
            difficulty
          }
        }
      }
    `;

    const variables = {
      userSlug: username,
    };

    const url = "https://leetcode.com/graphql/";
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      const data = await response.json();
      const questionData: QuestionData[] =
        data.data.userProfileUserQuestionProgressV2.numAcceptedQuestions;

      const easyQues =
        questionData.find((q) => q.difficulty === "EASY")?.count || 0;
      const mediumQues =
        questionData.find((q) => q.difficulty === "MEDIUM")?.count || 0;
      const hardQues =
        questionData.find((q) => q.difficulty === "HARD")?.count || 0;

      await setLeetCodeDatabyGithubId(githubId, easyQues, mediumQues, hardQues);

      return true;
    } catch (error) {
      await logToDiscord(`processLeetcodeData: ${(error as any).message}`, "ERROR");

      console.error("Error fetching Leetcode data:", error);
      return false;
    }
  } catch (error) {
    await logToDiscord(`processLeetcodeData: ${(error as any).message}`, "ERROR");
    console.error("Error processing LeetCode proof:", error);
    return false;
  }
}
