import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";

export async function GET() {
  const session = await getSessionFromRequestCookies();
  return NextResponse.json({ user: session ?? null });
}
