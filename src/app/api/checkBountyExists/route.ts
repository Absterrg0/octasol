import { db } from "@/lib/db";
import { NextResponse } from "next/server";




export  async function POST(req:Request){
    const {issueNumber,repoName} = await req.json();

    const bounty = await db.bounty.findFirst({
        where:{
            issueNumber,
            repoName
        }
    })

    return NextResponse.json({
        bounty
    },{
        status:200
    });
}