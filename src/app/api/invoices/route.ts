import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { createInvoiceSchema } from "@/lib/validators";
import { createInvoice, listInvoices } from "@/lib/repositories";

export async function GET() {
  const invoices = await listInvoices();
  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();
  const body = await request.json();
  const parsed = createInvoiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const invoice = await createInvoice(parsed.data, session?.userId ?? null);
  return NextResponse.json({ invoice }, { status: 201 });
}
