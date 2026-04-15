import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { updateInvoiceSchema } from "@/lib/validators";
import { deleteInvoice, getInvoiceById, updateInvoice } from "@/lib/repositories";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const invoice = await getInvoiceById(params.id);
  if (!invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = await request.json();
  const parsed = updateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const invoice = await updateInvoice(params.id, parsed.data, session.userId);
    return NextResponse.json({ invoice });
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
    await deleteInvoice(params.id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}
