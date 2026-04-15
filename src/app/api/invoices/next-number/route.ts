import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Retourne le prochain numero qui sera genere, SANS incrementer (preview)
export async function GET() {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const settings = await prisma.appSettings.findFirst();
  const prefix = settings?.invoicePrefix || "FAC";
  const year = new Date().getFullYear();
  const counter = await prisma.counter.findUnique({ where: { key: `invoice_${year}` } });
  const next = (counter?.value ?? 0) + 1;
  return NextResponse.json({ preview: `${prefix}-${year}-${String(next).padStart(4, "0")}` });
}
