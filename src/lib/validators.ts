import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createInvoiceSchema = z.object({
  reference: z.string().min(3),
  supplierName: z.string().min(2),
  amount: z.number().positive(),
  dueDate: z.string().min(10),
  category: z.enum(["ASSURANCE", "ACHATS", "ESSENCE", "LOYER", "TELECOM", "LOGICIELS", "FOURNITURES", "TRANSPORT", "AUTRES"]),
  source: z.enum(["SCAN", "PDF", "EMAIL", "MANUEL"]),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(["A_QUALIFIER", "A_VALIDER", "A_PAYER", "REPORT_DEMANDE", "PAYEE", "ARCHIVEE"]),
});

export const requestPostponeSchema = z.object({
  reason: z.string().min(3).max(250),
});

export const payInvoiceSchema = z.object({
  paymentDate: z.string().min(10),
});

export const updateBudgetSchema = z.object({
  monthKey: z.string().min(7),
  monthLabel: z.string().min(3),
  purchaseBudget: z.number().nonnegative(),
  expenseBudget: z.number().nonnegative(),
  reserveAvailable: z.number().nonnegative(),
});
