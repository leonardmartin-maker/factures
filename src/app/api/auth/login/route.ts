import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { loginWithTotpSchema } from "@/lib/validators";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotp, verifyBackupCode } from "@/lib/totp";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // Rate limit par IP : 10 tentatives / 15 min
  const ip = getClientIp(request);
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Trop de tentatives. Reessayez dans ${Math.ceil(rl.resetIn / 60000)} min.` }, { status: 429 });
  }

  const body = await request.json();
  const parsed = loginWithTotpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });

  // 2FA requis ?
  if (user.totpEnabled && user.totpSecret) {
    const { totpToken, backupCode } = parsed.data;
    if (!totpToken && !backupCode) {
      return NextResponse.json({ mfaRequired: true }, { status: 200 });
    }
    if (totpToken) {
      if (!verifyTotp(user.totpSecret, totpToken)) {
        return NextResponse.json({ error: "Code a 2 facteurs invalide", mfaRequired: true }, { status: 401 });
      }
    } else if (backupCode && user.totpBackupCodes) {
      const r = verifyBackupCode(user.totpBackupCodes, backupCode);
      if (!r.valid) return NextResponse.json({ error: "Code de secours invalide", mfaRequired: true }, { status: 401 });
      await prisma.user.update({ where: { id: user.id }, data: { totpBackupCodes: r.remainingHashes ?? null } });
    }
  }

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  });
  await setSessionCookie(token);
  return NextResponse.json({ ok: true });
}
