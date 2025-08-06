import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";





export async function POST(req:NextRequest){
    try{
        const {bountyId,status,transactionSuccess} = await req.json();
        const bounty = await db.bounty.findUnique({
            where:{
                id:bountyId
            }
        })
        if(!bounty){
            return NextResponse.json({
                msg:"Bounty not found",
                status:404
            })
        }
        await db.bounty.update({
            where:{
                id:bountyId
            },
            data:{
                status:status
            }
        })

        return NextResponse.json({
            msg:"Bounty status updated successfully",
            status:200
        })
    }
    catch(e){
        console.error(e);
        return NextResponse.json({
            msg:"Internal Server Error",
            status:500
        })

    }
}