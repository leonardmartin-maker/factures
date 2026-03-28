import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { updateInvoiceStatusSchema } from "@/lib/validators";
import { updateInvoiceStatus } from "@/lib/repositories";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  const body = await request.json();
  const parsed = updateInvoiceStatusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const invoice = await updateInvoiceStatus(params.id, parsed.data.status, session?.userId ?? null);
  return NextResponse.json({ invoice });
}
