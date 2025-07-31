import { getUserByAuthHeader } from "@/lib/apiUtils";
import { bigintToString } from "@/lib/utils";
import { logToDiscord } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return NextResponse.json(
      { error: "Authorization header is required" },
      { status: 400 }
    );
  }
  const user = await getUserByAuthHeader(authHeader);
  if (!user) {
    return NextResponse.json(
      { error: "Invalid Authorization Header" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    const sponsors = await db.sponsor.findMany({
      where: { githubId: BigInt(user.id) },
      include: {
        bounties: {
          where: status ? { status: parseInt(status) } : {},
          include: { submissions: true },
        },
      },
    });

    if (!sponsors || sponsors.length === 0) {
      return NextResponse.json(
        { error: "No sponsor profiles found" },
        { status: 404 }
      );
    }

    const sponsorsData = sponsors.map((sponsor) => {
      const totalRewarded = sponsor.bounties
        .filter((b) => b.status === 3)
        .reduce((sum, b) => sum + b.price, 0);
      const totalListings = sponsor.bounties.length;
      const totalSubmissions = sponsor.bounties.reduce(
        (sum, b) => sum + b.submissions.length,
        0
      );

      return {
        sponsor: {
          id: sponsor.id,
          name: sponsor.name,
          image: sponsor.image,
          createdAt: sponsor.createdAt,
          description: sponsor.description || "",
          type: sponsor.type,
          link: sponsor.link,
          twitter: sponsor.twitter,
          telegram: sponsor.telegram,
          discord: sponsor.discord,
        },
        metrics: {
          totalRewarded,
          totalListings,
          totalSubmissions,
        },
        bounties: bigintToString(sponsor.bounties),
      };
    });

    return NextResponse.json({
      success: true,
      data: sponsorsData,
    });
  } catch (error) {
    await logToDiscord(`sponsor/dashboard: ${(error as any).message}`, "ERROR");
    return NextResponse.json(
      { success: false, message: (error as any).message },
      { status: 500 }
    );
  }
}
