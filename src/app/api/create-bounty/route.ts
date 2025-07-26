import { NextRequest, NextResponse } from "next/server";




export async function POST(req:NextRequest){

    try{
        

    }
    catch(e){
        return NextResponse.json({
            msg:"Internal server error"
        },{status:500})
    }

}

