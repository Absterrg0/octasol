import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";






export async function POST(req:NextRequest){
    try{
        const {userId,repo} = await req.json();
        const description = repo.description === null ? "" : repo.description;
        const sponsor = await db.sponsor.create({
            data:{
                githubId:userId,
                type:"Github Issue",
                image:repo.owner.avatar_url,
                link:repo.html_url,
                description:description,
                name:repo.full_name,
                telegram:"Not found",
                twitter:"Not found",
                discord:"Not found",
            }
        })
        if(sponsor){
            return NextResponse.json({msg:"Sponsor set from github"},{status:200});
        }
        else{
            return NextResponse.json({msg:"Failed to set sponsor from github"},{status:500});
        }
    }
    catch(e){
        console.error(e);
        return NextResponse.json({msg:"Internal server error"},{status:500});
    }
}