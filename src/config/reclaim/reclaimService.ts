import { ReclaimProofRequest } from '@reclaimprotocol/js-sdk';
import { processHackerRankData } from "./hackerrank/service";
import { processSuperteamEarnData } from "./superteamearn/service";
import { processLeetcodeData } from "./leetcode/service";
import { processGeeksForGeeksData } from "./geeksforgeeks/service";
import { processCodechefData } from "./codechef/service";
import { logToDiscord } from "@/utils/logger";

const APP_ID = process.env.RECLAIM_APP_ID!;
const APP_SECRET = process.env.RECLAIM_APP_SECRET!;

export async function signWithProviderID(
  githubId: any,
  providerId: string,
  providerName: string
) {
  const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, providerId);

  reclaimProofRequest.setRedirectUrl("https://octasol.io/connect");
  const requestUrl = await reclaimProofRequest.getRequestUrl();

  await handleReclaimSession(githubId, reclaimProofRequest, providerName);

  return requestUrl;
}

async function handleReclaimSession(
  githubId: any,
  reclaimProofRequest: any,
  providerName: string
) {
  await reclaimProofRequest.startSession({
    onSuccess: async (proofs: any) => {
      try {
        let processedData;
        switch (providerName) {
          case "Hackerrank":
            processedData = await processHackerRankData(
              githubId,
              proofs,
              providerName
            );
            break;

          case "SuperteamEarn":
            processedData = await processSuperteamEarnData(
              githubId,
              proofs,
              providerName
            );
            break;

          case "Leetcode":
            processedData = await processLeetcodeData(
              githubId,
              proofs,
              providerName
            );
            break;

          case "Geeksforgeeks":
            processedData = await processGeeksForGeeksData(
              githubId,
              proofs,
              providerName
            );
            break;

          case "Codechef":
            processedData = await processCodechefData(
              githubId,
              proofs,
              providerName
            );
            break;

          default:
            throw new Error(`Unsupported provider: ${providerName}`);
        }
      } catch (error) {
        await logToDiscord(`reclaimService/handleReclaimSession: ${(error as any).message}`, "ERROR");

        console.error(
          `Failed to process Reclaim proof for githubId: ${githubId}`,
          error
        );
      }
    },
    onError: (error: any) => {
      console.error(`Verification failed for githubId: ${githubId}`, error);
    },
  });
}
