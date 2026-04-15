import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { deleteSupplier, getSupplierById, updateSupplier } from "@/lib/repositories";
import { updateSupplierSchema } from "@/lib/validators";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const supplier = await getSupplierById(params.id);
  if (!supplier) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ supplier });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const body = await request.json();
  const parsed = updateSupplierSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  try {
    const supplier = await updateSupplier(params.id, parsed.data, session.userId);
    return NextResponse.json({ supplier });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  if (session.role !== "ADMIN" && session.role !== "ACCOUNTING") {
    return NextResponse.json({ error: "Permission refusee" }, { status: 403 });
  }
  try {
    await deleteSupplier(params.id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}
