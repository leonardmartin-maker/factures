import { z } from "zod";

const CATEGORY = z.enum(["ASSURANCE", "ACHATS", "ESSENCE", "LOYER", "TELECOM", "LOGICIELS", "FOURNITURES", "TRANSPORT", "AUTRES"]);
const SOURCE = z.enum(["SCAN", "PDF", "EMAIL", "MANUEL"]);
const STATUS = z.enum(["A_QUALIFIER", "A_VALIDER", "A_PAYER", "REPORT_DEMANDE", "PAYEE", "ARCHIVEE"]);
const CURRENCY = z.enum(["CHF", "EUR", "USD", "GBP"]);
const PAYMENT_METHOD = z.enum(["VIREMENT", "CARTE", "PRELEVEMENT", "ESPECES", "CHEQUE", "AUTRE"]).optional().nullable();
const ROLE = z.enum(["ADMIN", "ACCOUNTING", "MANAGER"]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const createInvoiceSchema = z.object({
  reference: z.string().min(3).optional(),
  supplierReference: z.string().max(100).optional().nullable(),
  supplierName: z.string().min(2),
  amount: z.number().positive(),
  vatRate: z.number().min(0).max(100).default(0),
  currency: CURRENCY.default("CHF"),
  issueDate: z.string().min(10).optional().nullable(),
  dueDate: z.string().min(10),
  paymentMethod: PAYMENT_METHOD,
  category: CATEGORY,
  source: SOURCE,
  notes: z.string().max(500).optional().nullable(),
});

export const updateInvoiceSchema = z.object({
  reference: z.string().min(3).optional(),
  supplierReference: z.string().max(100).optional().nullable(),
  supplierName: z.string().min(2).optional(),
  amount: z.number().positive().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  currency: CURRENCY.optional(),
  issueDate: z.string().min(10).optional().nullable(),
  dueDate: z.string().min(10).optional(),
  paymentMethod: PAYMENT_METHOD,
  category: CATEGORY.optional(),
  source: SOURCE.optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateInvoiceStatusSchema = z.object({
  status: STATUS,
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

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caracteres"),
});

// Suppliers
export const createSupplierSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().max(250).optional().nullable(),
  iban: z.string().max(40).optional().nullable(),
  bic: z.string().max(15).optional().nullable(),
  contactName: z.string().max(100).optional().nullable(),
  vatNumber: z.string().max(40).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  category: z.string().max(60).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// Users
export const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  role: ROLE,
  password: z.string().min(8, "8 caracteres minimum"),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(100).optional(),
  role: ROLE.optional(),
});

export const resetUserPasswordSchema = z.object({
  newPassword: z.string().min(8, "8 caracteres minimum"),
});

// Settings
export const updateSettingsSchema = z.object({
  companyName: z.string().max(120).optional().nullable(),
  companyVat: z.string().max(40).optional().nullable(),
  companyAddress: z.string().max(250).optional().nullable(),
  companyEmail: z.string().email().optional().nullable().or(z.literal("")),
  companyPhone: z.string().max(30).optional().nullable(),
  companyLogo: z.string().max(500).optional().nullable(),
  defaultCurrency: CURRENCY.optional(),
  defaultVatRate: z.number().min(0).max(100).optional(),
  invoicePrefix: z.string().min(1).max(20).optional(),
  overdueReminders: z.boolean().optional(),
});

// Payments
export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  paidAt: z.string().min(10),
  method: z.string().max(30).optional().nullable(),
  note: z.string().max(300).optional().nullable(),
});

// Password reset
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export const resetPasswordTokenSchema = z.object({
  token: z.string().min(16),
  newPassword: z.string().min(8),
});

// 2FA
export const verifyTotpSchema = z.object({
  token: z.string().min(6).max(10),
});
export const loginWithTotpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totpToken: z.string().optional(),
  backupCode: z.string().optional(),
});
