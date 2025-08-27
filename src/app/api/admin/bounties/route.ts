import { db } from "@/lib/db";
import { bigintToString } from "@/lib/utils";
import { getUserByAuthHeader } from "@/lib/apiUtils";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header is required" },
        { status: 401 }
      );
    }

    const user = await getUserByAuthHeader(authHeader);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid Authorization Header" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const adminStatus = await isAdmin(user.login);

    if (!adminStatus) {
      return NextResponse.json(
        { error: "Access denied. Admin privileges required." },
        { status: 403 }
      );
    }


    const bounties = await db.bounty.findMany({
      where: {
        status:8,
      },
      include: {
        sponsor: true,
        submissions: {
          include: {
            user: {
              select: {
                githubUsername: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    console.log(bounties);

    const safe = bigintToString(bounties);
    return NextResponse.json({
      success: true,
      data: safe,
      count: safe.length,
    });

  } catch (error) {
    console.error("Error fetching admin bounties:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
