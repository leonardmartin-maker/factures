import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { requestPostponeSchema } from "@/lib/validators";
import { requestInvoicePostpone } from "@/lib/repositories";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  const body = await request.json();
  const parsed = requestPostponeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const invoice = await requestInvoicePostpone(params.id, parsed.data.reason, session?.userId ?? null);
  return NextResponse.json({ invoice });
}
