import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validators";
import { renderResetPasswordEmail, sendMail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });

  const body = await request.json();
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  // Reponse generique pour ne pas divulguer si l'email existe
  if (!user) return NextResponse.json({ ok: true });

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });

  const appUrl = process.env.APP_URL ?? "https://factures.swissworkingdev.ch";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;
  const { html, text } = renderResetPasswordEmail(resetUrl);
  await sendMail({ to: user.email, subject: "Reinitialisation de votre mot de passe", html, text });

  return NextResponse.json({ ok: true });
}
