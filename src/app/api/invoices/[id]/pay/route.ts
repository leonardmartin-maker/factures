import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { payInvoiceSchema } from "@/lib/validators";
import { markInvoicePaid } from "@/lib/repositories";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  const body = await request.json();
  const parsed = payInvoiceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const invoice = await markInvoicePaid(params.id, parsed.data.paymentDate, session?.userId ?? null);
  return NextResponse.json({ invoice });
}
