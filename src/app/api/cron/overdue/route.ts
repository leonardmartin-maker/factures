import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderOverdueEmail, sendMail } from "@/lib/email";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const providedSecret = auth?.replace(/^Bearer /, "") ?? url.searchParams.get("secret");
  if (!secret || providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.overdueReminders) {
    return NextResponse.json({ ok: true, skipped: "overdueReminders desactive" });
  }

  const now = new Date();
  const overdue = await prisma.invoice.findMany({
    where: {
      dueDate: { lt: now },
      status: { in: ["A_QUALIFIER", "A_VALIDER", "A_PAYER", "REPORT_DEMANDE"] },
    },
    include: { supplier: true },
    orderBy: { dueDate: "asc" },
  });

  if (overdue.length === 0) {
    return NextResponse.json({ ok: true, overdueCount: 0 });
  }

  const admins = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "ACCOUNTING"] } } });
  const appUrl = process.env.APP_URL ?? "https://factures.swissworkingdev.ch";

  const results: any[] = [];
  for (const admin of admins) {
    const { html, text } = renderOverdueEmail(
      admin.fullName,
      overdue.map((i) => ({
        reference: i.reference,
        supplierName: i.supplier.name,
        amount: Number(i.amount),
        currency: i.currency,
        dueDate: i.dueDate.toISOString(),
        daysOverdue: Math.floor((now.getTime() - i.dueDate.getTime()) / 86400000),
      })),
      appUrl
    );
    const r = await sendMail({ to: admin.email, subject: `[Factures Pro] ${overdue.length} facture(s) en retard`, html, text });
    results.push({ to: admin.email, ...r });
  }

  return NextResponse.json({ ok: true, overdueCount: overdue.length, notified: results });
}
