import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  
  return NextResponse.json({
    hasSession: !!session,
    userEmail: session?.user?.email || null,
    sessionKeys: session ? Object.keys(session) : [],
    env: {
       NEXTAUTH_URL: process.env.NEXTAUTH_URL || "MISSING",
       NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "MISSING",
       NODE_ENV: process.env.NODE_ENV
    }
  });
}
