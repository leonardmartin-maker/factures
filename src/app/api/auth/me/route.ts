import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ user: null });
  const u = await prisma.user.findUnique({ where: { id: session.userId } });
  return NextResponse.json({
    user: u ? {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      totpEnabled: u.totpEnabled,
    } : null,
  });
}
