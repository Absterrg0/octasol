import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getAccessToken } from "@/lib/apiUtils";
import { getInstallationId } from "@/utils/dbUtils";

export async function POST(req: NextRequest) {
    try {
        const { bountyId, status, transactionSuccess, githubId } = await req.json();
        
        // Find the bounty with its submissions
        const bounty = await db.bounty.findUnique({
            where: {
                id: bountyId
            },
            include: {
                submissions: {
                    where: {
                        githubPRNumber: {
                            not: null
                        }
                    }
                }
            }
        });

        if (!bounty) {
            return NextResponse.json({
                msg: "Bounty not found",
                status: 404
            });
        }

        // Update bounty status
        await db.bounty.update({
            where: {
                id: bountyId
            },
            data: {
                status: status
            }
        });

        // If bounty is being cancelled and there are submissions with PRs, close them
        if (status === 7 && bounty.submissions.length > 0) { // Assuming status 7 is cancelled
            try {
                // Get installation ID for GitHub API access
                const installationId = await getInstallationId(BigInt(githubId));
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

                            // Add cancellation comment to the PR
                            const commentBody = `## 🚫 Bounty Cancelled

This bounty has been **cancelled** by the maintainer. The associated pull request has been closed.

**Reason:** The bounty for this issue has been cancelled and is no longer available.

---

If you have any questions, please contact the repository maintainer.

*This bounty was managed by [Octasol.io](https://octasol.io) - the decentralized platform for open-source bounties.*`;

                            await axios.post(
                                `https://api.github.com/repos/${bounty.repoName}/issues/${submission.githubPRNumber}/comments`,
                                {
                                    body: commentBody
                                },
                                {
                                    headers: {
                                        Authorization: `token ${accessToken}`,
                                        Accept: "application/vnd.github.v3+json",
                                    },
                                }
                            );

                            console.log(`Successfully closed PR #${submission.githubPRNumber} for bounty ${bountyId}`);
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

        return NextResponse.json({
            msg: "Bounty status updated successfully",
            status: 200
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({
            msg: "Internal Server Error",
            status: 500
        });
    }
}