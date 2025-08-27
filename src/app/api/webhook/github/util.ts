import { getAccessToken } from "@/lib/apiUtils";
import { getBountiesByRepoName, getInstallationId, getWinnerBountySubmission, setEscrowedSubmission } from "@/utils/dbUtils";
import axios from "axios";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { db } from "@/lib/db";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { OctasolContract } from "../../../../../contract/types/octasol_contract";
import idl from "../../../../../contract/idl/octasol_contract.json";

import { BN } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet' 
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { generateBountyKeypair } from "@/lib/utils";

// Helper function to extract issue number from PR body or title
export function extractIssueNumber(body: string | null, title: string | null): number | null {
  const text = (body || '') + ' ' + (title || '');
  
  // Look for patterns like "closes #123", "fixes #123", "resolves #123"
  const issueLinkRegex = /(?:closes|fixes|resolves)\s+#(\d+)/i;
  const match = text.match(issueLinkRegex);
  
  if (match) {
    return parseInt(match[1], 10);
  }
  
  // If no explicit link, try to find issue number in title
  const titleIssueRegex = /#(\d+)/;
  const titleMatch = title?.match(titleIssueRegex);
  
  if (titleMatch) {
    return parseInt(titleMatch[1], 10);
  }
  
  return null;
}

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

    // Improved wallet address validation with proper Solana PublicKey validation
    const solWalletRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
    const walletMatch = prBody.match(solWalletRegex);
    let walletAddress = walletMatch ? walletMatch[0] : "";
    let walletSource = ''; // Track where wallet address came from
    
    // If no wallet address found in PR description, check database for user's wallet
    if (!walletAddress) {
        try {
            const user = await db.user.findUnique({
                where: {
                    githubId: BigInt(githubId)
                },
                select: {
                    walletAddress: true
                }
            });
            
            if (user?.walletAddress) {
                walletAddress = user.walletAddress;
                walletSource = 'database';
            }
        } catch (dbError) {
            console.error('Error fetching user wallet from database:', dbError);
        }
    } else {
        walletSource = 'pr_description';
    }
    
    let publicKey = null;
    if (walletAddress) {
        try {
          // Validate wallet address using Solana PublicKey constructor
          publicKey = new PublicKey(walletAddress);
          // Additional validation: ensure it's a valid Ed25519 public key
          if (!publicKey.toBytes || publicKey.toBytes().length !== 32) {
            throw new Error('Invalid public key length');
          }
        } catch (error) {
          console.error(`Invalid Solana wallet address: ${walletAddress}`, error);
          // Don't throw error, just log and continue without wallet
          walletAddress = "";
          publicKey = null;
        }
    }

    const bounties = await getBountiesByRepoName(repoName);
    const bounty = bounties?.find((bounty: any) => bounty.issueNumber === issueNumber);
    
    if (bounty) {
        // Check if there's already a winner submission for this bounty
        const existingWinnerSubmission = await db.submission.findFirst({
            where: {
                bountyId: bounty.id,
                status: 2 // Winner status
            }
        });

        const accessToken = await getAccessToken(installationId);
        
        if (existingWinnerSubmission) {
            // A contributor has already been assigned to this bounty
            const commentBody = `## Bounty Already Assigned

A contributor has already been assigned to this bounty. Feel free to work on this issue, but your contribution **will not be considered for the bounty payout**.

The bounty is currently being worked on by another contributor who has been officially assigned.

---
### Alternative Opportunities

Check out other open bounties on [Octasol.io](https://octasol.io) for similar opportunities!`;

            try {
                await axios.post(`https://api.github.com/repos/${repoName}/issues/${pullRequestNumber}/comments`, {
                    body: commentBody
                }, {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: "application/vnd.github.v3+json",
                    },
                });
            } catch (error) {
                console.error('Error posting comment for already assigned bounty:', error);
            }
            return; // Exit early, don't create a submission
        }

        // No winner submission exists, proceed with normal submission process
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
            
            // Format wallet address for display (first 3 + last 4 characters)
            const formatWalletDisplay = (address: string) => {
                if (!address) return '';
                return `${address.slice(0, 3)}...${address.slice(-4)}`;
            };

            let commentBody = '';
            
            if (walletAddress) {
                const walletDisplay = formatWalletDisplay(walletAddress);
                
                if (walletSource === 'pr_description') {
                    commentBody = `## Submission Confirmed!

We've received your submission and it's now awaiting review for the bounty. If approved, You will be assigned to the bounty and funds will be released from the escrow to the wallet address you provided after completion.

**Wallet Address:** \`${walletDisplay}\`

---
### How to Receive Your Payout

Once your work is approved and the PR is merged, the funds will be released to the wallet address that you have provided in the PR.

---
### Tip

For a better experience with future bounties, consider logging into [Octasol.io](https://octasol.io) and connecting your wallet. This way, you won't need to include your wallet address in every PR description!`;
                } else if (walletSource === 'database') {
                    commentBody = `## Submission Confirmed!

We've received your submission and it's now awaiting review for the bounty. If approved, You will be assigned to the bounty and funds will be released from the escrow to the wallet address you provided after completion.

**Wallet Address:** \`${walletDisplay}\` (from your Octasol profile)

---
### How to Receive Your Payout

Once your work is approved and the PR is merged, the funds will be released to the wallet address from your Octasol profile after completion.

---

Your wallet address was automatically detected from your profile.`;
                }
            } else {
                commentBody = `## Submission Pending!!!

Your pull request has been received, but it is **not considered a submission for the bounty** because we could not detect a wallet address.

To be eligible for the bounty payout, please provide a valid wallet address either in your PR description or by connecting your wallet on [Octasol.io](https://octasol.io).

**Note:** No wallet address detected in your PR description or Octasol profile.

---
### How to Complete Your Submission

1. **Option 1:** Close this PR and create a new one with your wallet address in the description
2. **Option 2:** Log into [Octasol.io](https://octasol.io) and connect your wallet for future bounties
`;
            }
            
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

export async function handleIssueClosed(repoName: string, issueNumber: number, installationId: number) {
  try {
    // Find the bounty for this issue
    const bounty = await db.bounty.findFirst({
      where: {
        repoName: repoName,
        issueNumber: issueNumber
      },
      include: {
        submissions: {
          where: {
            status: 2 // Winner status
          }
        }
      }
    });

    if (!bounty) {
      console.log(`No bounty found for issue ${issueNumber} in repo ${repoName}`);
      return;
    }

    // Check if there's a winner submission and if the issue was closed by a merged PR
    if (bounty.submissions.length > 0) {
      // There's a winner submission - check if the issue was closed by the winner PR
      const winnerSubmission = bounty.submissions[0];
      
      // Get recent PRs for this issue to check if the winner PR was merged
      const accessToken = await getAccessToken(installationId);
      
      try {
        // Get the issue to see if it was closed by a PR
        const issueResponse = await axios.get(
          `https://api.github.com/repos/${repoName}/issues/${issueNumber}`,
          {
            headers: {
              Authorization: `token ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );

        const issue = issueResponse.data;
        
        // Check if the issue was closed by a PR (pull_request field will be present)
        if (issue.pull_request && issue.pull_request.merged_at) {
          // Issue was closed by a merged PR
          const mergedPRNumber = issue.pull_request.number;
          
          // Check if this merged PR is the winner PR
          if (mergedPRNumber === winnerSubmission.githubPRNumber) {
            // This is the winner PR being merged - don't move to conflicted state
            // The releasePayment function will handle this properly
            console.log(`Issue ${issueNumber} closed by winner PR ${mergedPRNumber} - not moving to conflicted state`);
            return;
          }
        }
      } catch (error) {
        console.error('Error checking issue details:', error);
        // If we can't check, proceed with conflicted state as fallback
      }
    }

    // If we reach here, either:
    // 1. No winner submission exists
    // 2. Issue was closed by something other than the winner PR
    // 3. Error occurred while checking issue details
    
    // Update bounty status to conflicted (status 8)
    await db.bounty.update({
      where: { id: bounty.id },
      data: { status: 8 }
    });

    // Post comment on the issue
    const accessToken = await getAccessToken(installationId);
    const commentBody = `## Bounty Status: Conflicted

This issue has been closed while a bounty was active. The bounty has been moved to a **conflicted state**.

**What this means:**
- The bounty is now under admin review
- The escrow funds will be handled by the Octasol team

**Next Steps:**
The Octasol team will review this situation and determine the appropriate action for the escrow funds.

---
*This is an automated message from the Octasol bounty system.*`;

    await axios.post(`https://api.github.com/repos/${repoName}/issues/${issueNumber}/comments`, {
      body: commentBody
    }, {
      headers: {
        Authorization: `token ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

  } catch (error) {
    console.error('Error handling issue closed:', error);
  }
}

export async function handleDifferentPRMerged(repoName: string, prNumber: number, installationId: number, issueNumber: number) {
  try {
    // Find the bounty for this issue
    const bounty = await db.bounty.findFirst({
      where: {
        repoName: repoName,
      },
      include: {
        submissions: {
          where: {
            status: 2 // Winner status
          }
        }
      }
    });

    if (!bounty) {
      console.log(`No bounty found for repo: ${repoName}, issue: ${prNumber}`);
      return;
    }

    // Always move bounty to conflicted state (status 8)
    await db.bounty.update({
      where: { id: bounty.id },
      data: { status: 8 }
    });

    console.log(`Bounty ${bounty.id} moved to conflicted state due to different PR merge`);

    // Post comment on the merged PR
    const accessToken = await getAccessToken(installationId);
    let commentBody = '';

    if (bounty.submissions.length > 0) {
      // There's a winner submission - this is a conflict with existing assignment
      commentBody = `## ⚠️ Bounty Conflict Detected

A different pull request has been merged for this issue while there was an active bounty with an assigned contributor.

**What happened:**
- This PR was merged, but there was already a bounty with an assigned contributor for this issue
- The bounty has been moved to "conflicted" state for admin review
- The original bounty contributor may still be eligible for payment

**What happens next:**
- Admins will review the situation and determine the appropriate action
- This may result in the bounty being cancelled or paid out to the original contributor

For further support, please contact the admins at [Octasol](https://octasol.io).`;
    } else {
      // No winner submission - this is a conflict with unassigned bounty
      commentBody = `## ⚠️ Bounty Conflict Detected

A pull request has been merged for this issue while there was an active bounty that had not been assigned to any contributor yet.

**What happened:**
- This PR was merged, but there was already a bounty created for this issue
- The bounty had not been assigned to any contributor yet
- The bounty has been moved to "conflicted" state for admin review

**What happens next:**
- Admins will review the situation and determine the appropriate action
- This may result in the bounty being cancelled or the escrow being returned

For further support, please contact the admins at [Octasol](https://octasol.io).`;
    }

    await axios.post(
      `https://api.github.com/repos/${repoName}/issues/${prNumber}/comments`,
      { body: commentBody },
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

  } catch (error) {
    console.error('Error in handleDifferentPRMerged:', error);
    // Don't post any comment on error to avoid cluttering
  }
}




export async function releasePayment(repoName: string, prNumber: number, installationId: number) {
  try {
    const SERVER_WALLET_SECRET_KEY = process.env.ADMIN_PRIVATE_KEY;
    if (!SERVER_WALLET_SECRET_KEY) {
      throw new Error('SERVER_WALLET_SECRET_KEY environment variable is not set.');
    }
    const privateKeyBuffer = bs58.decode(SERVER_WALLET_SECRET_KEY);
    const serverKeypair = Keypair.fromSecretKey(privateKeyBuffer);
    const serverWallet = new NodeWallet(serverKeypair);

    // Create the connection object outside of a React hook
    const connection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    
    const winnerSubmission = await db.submission.findFirst({
      where: {
        githubPRNumber: prNumber,
        status: 2,
        bounty: {
          repoName: repoName,
        },
      },
    });

    const accessToken = await getAccessToken(installationId);

    if (!winnerSubmission) {
      // No winner submission found, post a comment on GitHub
      const commentBody = `## ⚠️ Contributor Not Assigned

You merged this bounty without assigning a contributor.

To ensure the bounty is paid out correctly, you must first assign a contributor via Octasol before merging the pull request.

For further support, please contact the admins at [Octasol](https://octasol.io).
`;

      await axios.post(
        `https://api.github.com/repos/${repoName}/issues/${prNumber}/comments`,
        { body: commentBody },
        {
          headers: {
            Authorization: `token ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      return { success: false, error: 'No winner submission found' };
    }

    if (!winnerSubmission.walletAddress) {
      console.error('Winner submission has no wallet address');
      return { success: false, error: 'No wallet address for winner' };
    }

    // Create the Anchor Provider with the server's wallet and the connection
    const provider = new AnchorProvider(connection, serverWallet, {
      preflightCommitment: 'confirmed',
      commitment: 'confirmed',
    });

    // Create the Program object
    const program = new Program(idl as OctasolContract, provider);

    const bountyAccountKp = generateBountyKeypair(winnerSubmission.bountyId.toString());
    const [escrowAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow_auth"), bountyAccountKp.publicKey.toBuffer()],
      program.programId
    );

    const USDCMintAddress = process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS || "";
    const USDCMint = new PublicKey(USDCMintAddress);
    const winnerAccount = new PublicKey(winnerSubmission.walletAddress);
    const bountyIdBN = new BN(winnerSubmission.bountyId);

    const contributorTokenAccount = getAssociatedTokenAddressSync(
      USDCMint,
      winnerAccount,
      false,
      TOKEN_PROGRAM_ID
    );

    const escrowTokenAccount = await getAssociatedTokenAddress(
      USDCMint,
      escrowAuthorityPda,
      true // PDA-owned account
    );

    // Check if contributor token account exists, create if not
    try {
      await connection.getTokenAccountBalance(contributorTokenAccount);
    } catch (error) {
      // Token account doesn't exist, create it
      const createATAInstruction = createAssociatedTokenAccountInstruction(
        serverWallet.publicKey, // payer
        contributorTokenAccount, // ata
        winnerAccount, // owner
        USDCMint // mint
      );

      const createATATx = new Transaction().add(createATAInstruction);
      await provider.sendAndConfirm(createATATx);
    }

    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
    const config: any = await (program as any).account.configState.fetch(configPda);
    const validAdmin = serverWallet.publicKey.equals(config.admin);
    if (!validAdmin) {
      throw new Error('Invalid admin');
    }

    // Execute the smart contract transaction
    const txSignature = await program.methods
      .completeBounty(bountyIdBN)
      .accounts({
        bounty: bountyAccountKp.publicKey,
        escrowAuthority: escrowAuthorityPda,
        maintainer: serverWallet.publicKey,
        contributor: winnerAccount,
        contributorTokenAccount: contributorTokenAccount,
        escrowTokenAccount: escrowTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        keeper: serverWallet.publicKey,
      })
      .rpc();

    // Wait for transaction confirmation
    const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');

    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }

    // Only update database after successful transaction confirmation
    await db.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: winnerSubmission.id },
        data: { status: 4 }
      });

      await tx.bounty.update({
        where: { id: winnerSubmission.bountyId },
        data: { status: 3 }
      });
    });

    const commentBody = `## Pull Request Merged & Bounty Released!

Congratulations! Your pull request has been **successfully merged**, and the bounty for this issue has been released.

**Funds have been sent to your Solana wallet address:** \`${winnerSubmission.walletAddress ? winnerSubmission.walletAddress.slice(0, 3) + "..." + winnerSubmission.walletAddress.slice(-4) : "N/A"}\`

**Transaction Signature:** \`${txSignature}\`

You can verify this transaction on [Solana Explorer](https://explorer.solana.com/tx/${txSignature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_CLUSTER}).

---

This bounty was managed and paid out using [Octasol](https://octasol.io) — the decentralized platform for open-source bounties.

If you haven't already, **sign up on [Octasol.io](https://octasol.io)** with your GitHub account and connect your crypto wallet for more bounties.

Thank you for contributing! 🚀
`;

    await axios.post(
      `https://api.github.com/repos/${repoName}/issues/${winnerSubmission.githubPRNumber}/comments`,
      { body: commentBody },
      {
        headers: {
          Authorization: `token ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    return { success: true, txSignature };

  } catch (error) {
    console.error('Failed to release payment:', error);
    return { success: false, error: error };
  }
}




  export async function conflictedBounty(repoName: string, prNumber: number, installationId: number, closedByMaintainer: boolean = false) {
    try {
      // Find the bounty and check if this PR is the winner


      const bounty = await db.bounty.findFirst({
        where: {
          repoName: repoName,
          submissions:{
            some:{
              githubPRNumber: prNumber,
            }
          },
        },
        include:{
          submissions:{
            where:{
              status:2
            }
          }    
        }
        
      });

      if (!bounty) {
        console.log(`No bounty found for repo: ${repoName}, issue: ${prNumber}`);
        return;
      }

      const isWinnerPR =  bounty.submissions.length > 0;
      
      if (isWinnerPR) {
        // Move bounty to conflicted state (status 8 - request to cancel)
        await db.bounty.update({
          where: { id: bounty.id },
          data: { status: 8 }
        });

      }

      const accessToken = await getAccessToken(installationId);

      // Only post comment if it's the winner PR
      if (isWinnerPR) {
        let commentBody: string;
        
        if (closedByMaintainer) {
          commentBody = `## ⚠️ Winner PR Closed by Maintainer

The assigned pull request for this bounty has been closed by the repository maintainer. This has triggered a conflict resolution process.

**What happens next:**
- The bounty has been moved to "conflicted" state
- Admins will review the situation and determine the appropriate action
- This may result in the bounty being cancelled or paid out to the winner

For further support, please contact the admins at [Octasol](https://octasol.io).
          `;
        } else {
          commentBody = `## ⚠️ Winner PR Closed by Contributor

The winning pull request for this bounty has been closed by the contributor. This has triggered a conflict resolution process.

**What happens next:**
- The bounty has been moved to "conflicted" state  
- Admins will review the situation and determine the appropriate action
- This may result in the bounty being cancelled or paid out to the winner

For further support, please contact the admins at [Octasol](https://octasol.io).
          `;
        }

        await axios.post(
          `https://api.github.com/repos/${repoName}/issues/${prNumber}/comments`,
          { body: commentBody },
          {
            headers: {
              Authorization: `token ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
            },
          }
        );
      }

    } catch (error) {
      console.error('Error in conflictedBounty:', error);
      // Don't post any comment on error to avoid cluttering
    }
  }
