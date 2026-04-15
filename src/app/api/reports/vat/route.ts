import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const basedOn = url.searchParams.get("basedOn") === "paymentDate" ? "paymentDate" : "issueDate";

  const where: any = {};
  if (from || to) {
    where[basedOn] = {};
    if (from) where[basedOn].gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); where[basedOn].lte = d; }
  }
  // Exclure les factures sans la date pertinente
  where[basedOn] = { ...where[basedOn], not: null };

  const invoices = await prisma.invoice.findMany({
    where,
    include: { supplier: true },
    orderBy: { [basedOn]: "asc" },
  });

  // Groupement par taux de TVA
  const byRate: Record<string, { rate: number; count: number; amountHt: number; vatAmount: number; amountTtc: number; currency: string }> = {};
  let totalHt = 0, totalVat = 0, totalTtc = 0;
  const byCurrency: Record<string, { amountHt: number; vatAmount: number; amountTtc: number; count: number }> = {};

  for (const inv of invoices) {
    const rate = Number(inv.vatRate ?? 0);
    const amount = Number(inv.amount);
    const ht = inv.amountHt !== null ? Number(inv.amountHt) : amount;
    const vat = inv.vatAmount !== null ? Number(inv.vatAmount) : 0;
    const key = `${rate}_${inv.currency}`;
    byRate[key] = byRate[key] ?? { rate, count: 0, amountHt: 0, vatAmount: 0, amountTtc: 0, currency: inv.currency };
    byRate[key].count++;
    byRate[key].amountHt += ht;
    byRate[key].vatAmount += vat;
    byRate[key].amountTtc += amount;
    byCurrency[inv.currency] = byCurrency[inv.currency] ?? { amountHt: 0, vatAmount: 0, amountTtc: 0, count: 0 };
    byCurrency[inv.currency].count++;
    byCurrency[inv.currency].amountHt += ht;
    byCurrency[inv.currency].vatAmount += vat;
    byCurrency[inv.currency].amountTtc += amount;
    totalHt += ht; totalVat += vat; totalTtc += amount;
  }

  return NextResponse.json({
    basedOn,
    from,
    to,
    totals: { count: invoices.length, amountHt: totalHt, vatAmount: totalVat, amountTtc: totalTtc },
    byCurrency,
    byRate: Object.values(byRate).sort((a, b) => a.rate - b.rate),
    invoices: invoices.map((i) => ({
      id: i.id,
      reference: i.reference,
      supplierName: i.supplier.name,
      issueDate: i.issueDate?.toISOString() ?? null,
      paymentDate: i.paymentDate?.toISOString() ?? null,
      amount: Number(i.amount),
      amountHt: i.amountHt !== null ? Number(i.amountHt) : null,
      vatRate: Number(i.vatRate ?? 0),
      vatAmount: i.vatAmount !== null ? Number(i.vatAmount) : null,
      currency: i.currency,
      status: i.status,
    })),
  });
}
