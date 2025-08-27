import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import axios from "axios";
import { getAccessToken } from "@/lib/apiUtils";
import { getUserByAuthHeader } from "@/lib/apiUtils";
import { getInstallationId } from "@/utils/dbUtils";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { createHash } from "crypto";
import { OctasolContract } from "../../../../contract/types/octasol_contract";
import idl from "../../../../contract/idl/octasol_contract.json";
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import { generateBountyKeypair } from "@/lib/utils";
import { isAdmin } from "@/lib/constants";

export async function POST(req: NextRequest) {
    try {
        const { bountyId, status = 7 } = await req.json();
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Authorization header is required" }, { status: 401 });
        }
        const user = await getUserByAuthHeader(authHeader);
        if (!user) {
            return NextResponse.json({ error: "Invalid Authorization Header" }, { status: 401 });
        }
        
 

        
        // Find the bounty with its submissions
        // Only the sponsor owner (by relation) can cancel; support multiple sponsors per user
        const bounty = await db.bounty.findFirst({
            where: {
                id: bountyId,
                sponsor: {
                    githubId: BigInt(user.id)
                }
            },
            include: {
                submissions: {
                    where: {
                        githubPRNumber: {
                            not: null
                        }
                    }
                },
                sponsor: true
            }
        });


        if (!bounty) {
            return NextResponse.json({
                msg: "Bounty not found",
            },{
                status:404
            });
        }

        // Authorization enforced via sponsor relation match in query

        // If not admin: only mark as request-to-cancel and return
        const adminStatus = await isAdmin(user.login);
        if (!adminStatus) {
            await db.bounty.update({
                where: { id: bountyId },
                data: { status: 8 },
            });
            return NextResponse.json({ success: true, message: "Cancellation requested" });
        }

        // Admin flow: execute blockchain cancel
        try {
            const SERVER_WALLET_SECRET_KEY = process.env.ADMIN_PRIVATE_KEY;
            if (!SERVER_WALLET_SECRET_KEY) {
                throw new Error('ADMIN_PRIVATE_KEY environment variable is not set.');
            }
            const privateKeyBuffer = bs58.decode(SERVER_WALLET_SECRET_KEY);
            const serverKeypair = Keypair.fromSecretKey(privateKeyBuffer);
            const serverWallet = new NodeWallet(serverKeypair);

            // Create the connection object
            const connection = new Connection(
                process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
                'confirmed'
            );

            // Create the Anchor Provider with the server's wallet and the connection
            const provider = new AnchorProvider(connection, serverWallet, {
                preflightCommitment: 'confirmed',
                commitment: 'confirmed',
            });

            // Create the Program object
            const program = new Program(idl as OctasolContract, provider);

            const bountyAccountKp = generateBountyKeypair(bountyId.toString());
            const [escrowAuthorityPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow_auth"), bountyAccountKp.publicKey.toBuffer()],
                program.programId
            );
            const [configPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("config")],
                program.programId
            );
            
            // Before fetching, ensure the on-chain account exists
            const accountInfo = await connection.getAccountInfo(bountyAccountKp.publicKey);
            if (!accountInfo) {
                // Not initialized on-chain. Finalize DB cancel and proceed to PR housekeeping.
                await db.bounty.update({ where: { id: bountyId }, data: { status: 7 } });
                // Continue to PR closures below
            } else {
                // Fetch the bounty account to get the maintainer
                // @ts-ignore anchor types
                const bountyAccount: any = await (program as any).account.bounty.fetch(bountyAccountKp.publicKey);
                const maintainer = bountyAccount.maintainer;

            const USDCMintAddress = process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS || "";
            const USDCMint = new PublicKey(USDCMintAddress);
            const maintainerTokenAccount = getAssociatedTokenAddressSync(
                USDCMint,
                maintainer,
                false,
                TOKEN_PROGRAM_ID
            );

            const escrowTokenAccount = await getAssociatedTokenAddress(
                USDCMint,
                escrowAuthorityPda,
                true // PDA-owned account
            );


            const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
            const config: any = await (program as any).account.configState.fetch(configPda);
            const validAdmin = serverWallet.publicKey.equals(config.admin);
            if (!validAdmin) {
              throw new Error('Invalid admin');
            }                // Execute the smart contract transaction
                const txSignature = await program.methods
                    .cancelBounty()
                    .accounts({
                        admin: serverWallet.publicKey,
                        config: configPda,
                        bounty: bountyAccountKp.publicKey,
                        escrowAuthority: escrowAuthorityPda,
                        maintainer: maintainer,
                        maintainerTokenAccount: maintainerTokenAccount,
                        escrowTokenAccount: escrowTokenAccount,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                        rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
                    })
                    .rpc();

                // Wait for transaction confirmation
                const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');

                if (confirmation.value.err) {
                    throw new Error(`Transaction failed: ${confirmation.value.err}`);
                }
            }


        } catch (blockchainError) {
            console.error('Failed to execute cancel bounty transaction:', blockchainError);
            return NextResponse.json(
                { error: "Failed to execute blockchain transaction" },
                { status: 500 }
            );
        }

        // Update bounty status in database (admin finalizes)
        await db.bounty.update({
            where: {
                id: bountyId
            },
            data: {
                status: 7
            }
        });

        // If bounty is being cancelled and there are submissions with PRs, close them
        if (bounty.submissions.length > 0) {
            try {
                // Get installation ID for GitHub API access (use sponsor owner)
                const installationId = await getInstallationId(bounty.sponsor!.githubId);
                const accessToken = await getAccessToken(Number(installationId));

                // Close each PR and add cancellation comment
                for (const submission of bounty.submissions) {
                    if (submission.githubPRNumber && bounty.repoName) {
                        try {
                            // Close the PR
                            await axios.patch(
                                `https://api.github.com/repos/${bounty.repoName}/pulls/${submission.githubPRNumber}`,
                                {
                                    state: "closed"
                                },
                                {
                                    headers: {
                                        Authorization: `token ${accessToken}`,
                                        Accept: "application/vnd.github.v3+json",
                                    },
                                }
                            );
             } catch (prError) {
                            console.error(`Failed to close PR #${submission.githubPRNumber}:`, prError);
                            // Continue with other PRs even if one fails
                        }
                    }
                }

                // Update all submissions status to rejected (status 3)
                await db.submission.updateMany({
                    where: {
                        bountyId: bountyId
                    },
                    data: {
                        status: 3 // Rejected status
                    }
                });

            } catch (githubError) {
                console.error("Error closing PRs:", githubError);
                // Continue with the response even if GitHub operations fail
            }
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}