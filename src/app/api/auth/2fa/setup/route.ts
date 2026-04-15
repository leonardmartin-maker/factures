import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildOtpAuthQrDataUrl, generateTotpSecret } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const secret = generateTotpSecret();
  // Stocke en pending (pas encore enabled)
  await prisma.user.update({ where: { id: session.userId }, data: { totpSecret: secret, totpEnabled: false } });
  const qrCode = await buildOtpAuthQrDataUrl(session.email, secret);
  return NextResponse.json({ secret, qrCode });
}
