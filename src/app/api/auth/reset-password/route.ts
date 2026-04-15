import { NextResponse } from "next/server";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { resetPasswordTokenSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = resetPasswordTokenSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const pr = await prisma.passwordReset.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!pr || pr.usedAt || pr.expiresAt < new Date()) {
    return NextResponse.json({ error: "Lien invalide ou expire" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: pr.userId }, data: { passwordHash } });
  await prisma.passwordReset.update({ where: { id: pr.id }, data: { usedAt: new Date() } });
  // Invalide tous les autres tokens de ce user
  await prisma.passwordReset.updateMany({ where: { userId: pr.userId, usedAt: null }, data: { usedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
