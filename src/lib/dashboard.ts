import { listAuditLogs, getLatestBudget, listInvoices, listReminders, listSuppliers, listUsers } from "@/lib/repositories";
import { getSettings, type AppSettingsData } from "@/lib/settings";

export type DashboardData = {
  stats: {
    totalToPay: number;
    totalPaid: number;
    overdueCount: number;
    totalPurchases: number;
    totalExpenses: number;
  };
  budget: {
    id: string;
    monthKey: string;
    monthLabel: string;
    purchaseBudget: number;
    expenseBudget: number;
    reserveAvailable: number;
  } | null;
  invoices: Awaited<ReturnType<typeof listInvoices>>;
  reminders: Awaited<ReturnType<typeof listReminders>>;
  auditLogs: Awaited<ReturnType<typeof listAuditLogs>>;
  suppliers: Awaited<ReturnType<typeof listSuppliers>>;
  users: Awaited<ReturnType<typeof listUsers>>;
  settings: AppSettingsData;
};

export async function getDashboardData(): Promise<DashboardData> {
  const [invoices, budget, reminders, auditLogs, suppliers, users, settings] = await Promise.all([
    listInvoices(),
    getLatestBudget(),
    listReminders(),
    listAuditLogs(),
    listSuppliers(),
    listUsers(),
    getSettings(),
  ]);

  const now = new Date();

  const totalToPay = invoices
    .filter((invoice) => ["A_QUALIFIER", "A_VALIDER", "A_PAYER", "REPORT_DEMANDE"].includes(invoice.status))
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const totalPaid = invoices
    .filter((invoice) => invoice.status === "PAYEE")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const overdueCount = invoices.filter((invoice) => invoice.status !== "PAYEE" && new Date(invoice.dueDate) < now).length;

  const totalPurchases = invoices
    .filter((invoice) => invoice.category === "ACHATS")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const totalExpenses = invoices
    .filter((invoice) => invoice.category !== "ACHATS")
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  return {
    stats: {
      totalToPay,
      totalPaid,
      overdueCount,
      totalPurchases,
      totalExpenses,
    },
    budget,
    invoices,
    reminders,
    auditLogs,
    suppliers,
    users,
    settings,
  };
}
