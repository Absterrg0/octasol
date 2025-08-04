import { getAccessToken } from "@/lib/apiUtils";
import { getBountiesByRepoName, getInstallationId, getWinnerBountySubmission, setEscrowedSubmission } from "@/utils/dbUtils";
import axios from "axios";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { db } from "@/lib/db";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { OctasolContract } from "../../../../../contract/types/octasol_contract";
import idl from "../../../../../contract/idl/octasol_contract.json";
import { BN } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";

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



const SERVER_WALLET_SECRET_KEY = process.env.SERVER_WALLET_SECRET_KEY;
if (!SERVER_WALLET_SECRET_KEY) {
  throw new Error('SERVER_WALLET_SECRET_KEY environment variable is not set.');
}

const privateKey = Buffer.from(JSON.parse(SERVER_WALLET_SECRET_KEY));
const serverKeypair = Keypair.fromSecretKey(privateKey);
const serverWallet = new Wallet(serverKeypair);

// Create the connection object outside of a React hook
const connection = new Connection(
  process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);
export async function releasePayment(repoName: string, prNumber: number) {
    try {
      const winnerSubmission = await db.submission.findFirst({
        where: {
          githubPRNumber: prNumber,
          bounty: {
            repoName: repoName,
          },
        },
      });
  
      if (!winnerSubmission) {
        console.log(`No winner submission found for PR ${prNumber} in repo ${repoName}`);
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
  
      const USDCMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
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
        console.log('Created contributor token account');
      }
  
      // Execute the smart contract transaction
      const txSignature = await program.methods
        .completeBounty(bountyIdBN)
        .accounts({
          bounty: bountyAccountKp.publicKey,
          escrowAuthority: escrowAuthorityPda,
          maintainer: serverWallet.publicKey,
          contributor: winnerAccount,
          contributorTokenAcocunt: contributorTokenAccount, // Fix typo: should be contributorTokenAccount
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
  
      console.log(`Bounty payment released successfully! Transaction signature: ${txSignature}`);
      return { success: true, txSignature };
  
    } catch (error) {
      console.error('Failed to release payment:', error);
      return { success: false, error: error };
    }
  }

  function generateBountyKeypair(bountyId: string): Keypair {
    // Create a deterministic seed from bounty ID
    const seedString = `octasol_bounty_${bountyId}`;
    const hash = createHash('sha256').update(seedString).digest();
    
    // Take first 32 bytes for keypair seed
    const keypairSeed = hash.slice(0, 32);
    
    return Keypair.fromSeed(keypairSeed);
  }