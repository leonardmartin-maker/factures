import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotpSchema } from "@/lib/validators";
import { generateBackupCodes, hashBackupCodes, verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = await request.json();
  const parsed = verifyTotpSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Code invalide" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.totpSecret) return NextResponse.json({ error: "Aucun secret en attente. Relancez la configuration." }, { status: 400 });

  if (!verifyTotp(user.totpSecret, parsed.data.token)) {
    return NextResponse.json({ error: "Code incorrect" }, { status: 401 });
  }

  const backupCodes = generateBackupCodes(8);
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true, totpBackupCodes: hashBackupCodes(backupCodes) },
  });

  return NextResponse.json({ ok: true, backupCodes });
}
