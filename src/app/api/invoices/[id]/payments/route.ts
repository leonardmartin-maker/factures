import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { addPayment, listPayments } from "@/lib/repositories";
import { createPaymentSchema } from "@/lib/validators";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const payments = await listPayments(params.id);
  return NextResponse.json({ payments });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const body = await request.json();
  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await addPayment(params.id, parsed.data, session.userId);
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}
