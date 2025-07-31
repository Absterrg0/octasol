import { getAccessToken } from "@/lib/apiUtils";
import { getBountiesByRepoName, getInstallationId, setEscrowedSubmission } from "@/utils/dbUtils";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";

export async function checkPRforLinkedIssue(body: string, repoName: string, installationId: number, pullRequestNumber: number, githubId: number) {
  
    const prBody = body || ''; // Default to an empty string if body is null
  
    const issueLinkRegex = /(?:closes|fixes|resolves)\s+#(\d+)/i;
    const match = prBody.match(issueLinkRegex);
    
    // If no issue link match is found, the PR is not linked in the way we expect.
    if (!match) {
      return;
    }
    
    // Safely extract the issue number. `match[1]` contains the digits captured by `(\d+)`.
    const issueNumber = parseInt(match[1], 10);

    const solWalletRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
    const walletMatch = prBody.match(solWalletRegex);
    const walletAddress = walletMatch ? walletMatch[0] : "";
    
    let publicKey = null;
    if (walletAddress) {
        try {
          publicKey = new PublicKey(walletAddress);
        } catch (error) {
          // Invalid wallet address - not on Solana curve
          console.log('Invalid Solana wallet address:', walletAddress);
          throw new Error(`Not a valid Solana public key: ${walletAddress}`);
        }
    }

    const bounties = await getBountiesByRepoName(repoName);
    const bounty = bounties?.find((bounty: any) => bounty.issueNumber === issueNumber);
    
    if (bounty) {
        try {
            await setEscrowedSubmission({
              bountyId: bounty.id,
              githubId: githubId,
              githubPRNumber: pullRequestNumber,
              status: 1,
              walletAddress: walletAddress, // Store as string in DB
              notes: body,
              links: [`https://github.com/${repoName}/pull/${pullRequestNumber}`]
            });

            const accessToken = await getAccessToken(installationId);
            const commentBody = `## Submission Received!

Your submission is now pending review for the bounty. If it's accepted, the funds will be transferred to an escrow account and released upon completion.

${walletAddress ? `**Wallet Address:** \`${walletAddress}\`` : '**Note:** No wallet address provided. Please add your Solana wallet address to your PR description for automatic payout.'}

---
### Next Steps for Payout

To ensure a smooth and automatic payout, please complete these one-time steps:

1.  **Sign up on [Octasol.io](https://octasol.io)** with your GitHub account.
2.  **Connect your crypto wallet** in your Octasol.io profile.

This will allow us to transfer the funds directly to your wallet once the work is approved.
`;

            const response = await axios.post(`https://api.github.com/repos/${repoName}/issues/${pullRequestNumber}/comments`, {
                body: commentBody
            }, {
                headers: {
                    Authorization: `token ${accessToken}`,
                    Accept: "application/vnd.github.v3+json",
                },
            });

        } catch (error) {
            console.error('Error processing submission:', error);
            throw error; // Re-throw to handle at calling level
        }
    }
}