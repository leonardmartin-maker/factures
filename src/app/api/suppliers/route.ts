import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { createSupplier, listSuppliers } from "@/lib/repositories";
import { createSupplierSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const suppliers = await listSuppliers();
  return NextResponse.json({ suppliers });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const body = await request.json();
  const parsed = createSupplierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const supplier = await createSupplier(parsed.data, session.userId);
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (e: any) {
    const msg = e.message ?? "Erreur";
    const status = msg.includes("Unique") ? 409 : 400;
    return NextResponse.json({ error: msg.includes("Unique") ? "Un fournisseur avec ce nom existe deja" : msg }, { status });
  }
}
