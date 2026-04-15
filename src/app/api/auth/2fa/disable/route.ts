import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: null },
  });
  return NextResponse.json({ ok: true });
}
