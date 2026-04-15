import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { deletePayment } from "@/lib/repositories";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  if (session.role !== "ADMIN" && session.role !== "ACCOUNTING") return NextResponse.json({ error: "Permission refusee" }, { status: 403 });
  try {
    await deletePayment(params.id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}
