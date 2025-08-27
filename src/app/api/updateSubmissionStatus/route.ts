import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import axios from "axios";
import { getAccessToken, getUserByAuthHeader } from "@/lib/apiUtils";
import { getInstallationId } from "@/utils/dbUtils";
import { isAdmin } from "@/lib/constants";

export async function POST(req: NextRequest) {
    try {
        const { submissionId, githubId } = await req.json();

        // 1. Validate the submission ID.
        if (!submissionId) {
            return NextResponse.json({
                msg: "No submission ID found"
            }, {
                status: 400
            });
        }

        if (!githubId) {
            return NextResponse.json({
                msg: "No GitHub ID found"
            }, {
                status: 400
            });
        }

        // 2. Authorization check - ensure user is bounty owner or admin
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return NextResponse.json({
                msg: "Authorization header is required"
            }, {
                status: 401
            });
        }

        const user = await getUserByAuthHeader(authHeader);
        if (!user) {
            return NextResponse.json({
                msg: "Invalid Authorization Header"
            }, {
                status: 401
            });
        }

        // Check if user is admin
        const adminStatus = await isAdmin(user.login);

        // If not admin, verify user owns the bounty
        if (!adminStatus) {
            const submission = await db.submission.findUnique({
                where: { id: submissionId },
                include: {
                    bounty: {
                        include: {
                            sponsor: true
                        }
                    }
                }
            });

            if (!submission) {
                return NextResponse.json({
                    msg: "Submission not found"
                }, {
                    status: 404
                });
            }

            // Check if user owns the bounty
            if (submission.bounty.sponsor?.githubId !== BigInt(user.id)) {
                return NextResponse.json({
                    msg: "You are not authorized to modify this submission"
                }, {
                    status: 403
                });
            }
        }

        const installationId = await getInstallationId(BigInt(githubId));

        // 2. Find the bountyId associated with the given submissionId.
        const winningSubmission = await db.submission.findUnique({
            where: { id: submissionId },
            select: { bountyId: true }
        });

        if (!winningSubmission) {
            return NextResponse.json({
                msg: "Submission not found"
            }, {
                status: 404
            });
        }

        const bountyId = winningSubmission.bountyId;

        // 3. Use a transaction to ensure both updates are atomic.
        // This means either both succeed or both fail.
        const [acceptedSubmission, rejectedSubmissions] = await db.$transaction([
            // Update the winning submission to status 2 (e.g., 'ACCEPTED').
            db.submission.update({
                where: {
                    id: submissionId
                },
                data: {
                    status: 2
                },
                include:{
                    bounty:true
                }
            }),
            
            // Update all other submissions for the same bounty to status 3 (e.g., 'REJECTED').
            db.submission.updateMany({
                where: {
                    bountyId: bountyId,
                    id: {
                        not: submissionId
                    }
                },
                data: {
                    status: 3
                }
            })
        ]);

        if(acceptedSubmission){
            const accessToken = await getAccessToken(Number(installationId));

            // Bounty comment with contributor instructions
                const commentBody =
                `✅ **Submission Accepted!**

This submission has been accepted and the wallet address \`${acceptedSubmission.walletAddress ? acceptedSubmission.walletAddress.slice(0, 3) + "..." + acceptedSubmission.walletAddress.slice(-4) : "N/A"}\` has been stored as the recipient of this bounty.

You may continue now.`;

                await axios.post(`https://api.github.com/repos/${acceptedSubmission.bounty.repoName}/issues/${acceptedSubmission.githubPRNumber}/comments`, {
                    body: commentBody
                }, {
                    headers: {
                        Authorization: `token ${accessToken}`,
                        Accept: "application/vnd.github.v3+json",
                    },
                });
            }

        // 4. Return a successful response.
        return NextResponse.json({
            msg: "Submission statuses updated successfully"
        }, {
            status: 200
        });

    } catch (e) {
        console.error(e);
        return NextResponse.json({
            msg: "Internal server error"
        }, {
            status: 500
        });
    }
}
