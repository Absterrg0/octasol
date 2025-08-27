// Database-based admin validation function
'use server'
import { db } from "@/lib/db";
export async function isAdmin(githubLogin: string): Promise<boolean> {
  if (!githubLogin) return false;
  
  try {
    
    // Check against admin table (case-insensitive)
    const admin = await db.admin.findFirst({
      where: {
        githubName: githubLogin.toLowerCase()
      }
    });
    console.log(admin);
    return !!admin;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}




