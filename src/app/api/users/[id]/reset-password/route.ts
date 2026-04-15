import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { resetUserPassword } from "@/lib/repositories";
import { resetUserPasswordSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Permission refusee" }, { status: 403 });
  const body = await request.json();
  const parsed = resetUserPasswordSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  try {
    const user = await resetUserPassword(params.id, parsed.data.newPassword, session.userId);
    return NextResponse.json({ user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}
