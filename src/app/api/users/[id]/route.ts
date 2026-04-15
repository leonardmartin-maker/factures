import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { deleteUser, updateUser } from "@/lib/repositories";
import { updateUserSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Permission refusee" }, { status: 403 });
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  try {
    const user = await updateUser(params.id, parsed.data, session.userId);
    return NextResponse.json({ user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Permission refusee" }, { status: 403 });
  try {
    await deleteUser(params.id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}
