import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logToDiscord } from "@/utils/logger";

export async function POST(req: NextRequest) {
  try {
    // Get the authorization token from headers
    const authToken = req.headers.get("x-admin-token");
    
    // Check if token is provided
    if (!authToken) {
      return NextResponse.json(
        { error: "Admin token is required" },
        { status: 401 }
      );
    }

    // Get the expected token from environment variables
    const expectedToken = process.env.ADMIN_TOKEN;
    
    if (!expectedToken) {
      console.error("ADMIN_TOKEN environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify the token
    if (authToken !== expectedToken) {
      await logToDiscord(
        `🚨 **Unauthorized Admin Population Attempt**\nToken provided: ${authToken.substring(0, 8)}...\nIP: ${req.headers.get('x-forwarded-for') || 'unknown'}`,
        "WARN"
      );
      return NextResponse.json(
        { error: "Invalid admin token" },
        { status: 403 }
      );
    }

    // Get the GitHub usernames from request body
    const { githubUsernames } = await req.json();

    // Validate input
    if (!githubUsernames || !Array.isArray(githubUsernames)) {
      return NextResponse.json(
        { error: "githubUsernames array is required" },
        { status: 400 }
      );
    }

    if (githubUsernames.length === 0) {
      return NextResponse.json(
        { error: "githubUsernames array cannot be empty" },
        { status: 400 }
      );
    }

    // Validate each username
    for (const username of githubUsernames) {
      if (typeof username !== 'string' || username.trim().length === 0) {
        return NextResponse.json(
          { error: "Invalid GitHub username provided" },
          { status: 400 }
        );
      }
    }

    // Clear existing admins and populate with new ones
    const result = await db.$transaction(async (tx) => {

      // Insert new admins
      const newAdmins = await Promise.all(
        githubUsernames.map(async (username) => {
          return await tx.admin.create({
            data: {
              githubName: username.trim().toLowerCase()
            }
          });
        })
      );

      return newAdmins;
    });

    // Log the successful operation
    await logToDiscord(
      `✅ **Admin Table Populated**\nAdmins: ${githubUsernames.join(', ')}\nCount: ${result.length}`,
      "INFO"
    );

    return NextResponse.json({
      success: true,
      message: `Successfully populated admin table with ${result.length} admins`,
      admins: result.map(admin => admin.githubName),
      count: result.length
    });

  } catch (error) {
    console.error("Error populating admin table:", error);
    
    await logToDiscord(
      `❌ **Admin Population Error**\nError: ${(error as Error).message}`,
      "ERROR"
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to list current admins (also protected)
export async function GET(req: NextRequest) {
  try {
    // Get the authorization token from headers
    const authToken = req.headers.get("x-admin-token");
    
    // Check if token is provided
    if (!authToken) {
      return NextResponse.json(
        { error: "Admin token is required" },
        { status: 401 }
      );
    }

    // Get the expected token from environment variables
    const expectedToken = process.env.ADMIN_POPULATE_TOKEN;
    
    if (!expectedToken) {
      console.error("ADMIN_POPULATE_TOKEN environment variable is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Verify the token
    if (authToken !== expectedToken) {
      return NextResponse.json(
        { error: "Invalid admin token" },
        { status: 403 }
      );
    }

    // Get all admins
    const admins = await db.admin.findMany({
      select: {
        id: true,
        githubName: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      admins,
      count: admins.length
    });

  } catch (error) {
    console.error("Error fetching admins:", error);
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
