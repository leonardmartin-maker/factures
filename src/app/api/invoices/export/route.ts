import { NextResponse } from "next/server";
import { listInvoices } from "@/lib/repositories";

function escapeCsv(value: string | number | null) {
  const normalized = value === null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

export async function GET() {
  const invoices = await listInvoices();
  const lines = [
    ["reference", "supplier", "amount", "currency", "status", "category", "dueDate", "paymentDate"].map(escapeCsv).join(","),
    ...invoices.map((invoice) => [
      invoice.reference,
      invoice.supplier.name,
      invoice.amount,
      invoice.currency,
      invoice.status,
      invoice.category,
      invoice.dueDate,
      invoice.paymentDate,
    ].map(escapeCsv).join(",")),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="factures-export.csv"',
    },
  });
}
