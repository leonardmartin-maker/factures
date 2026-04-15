import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

type CreateInvoiceInput = {
  reference?: string;
  supplierReference?: string | null;
  supplierName: string;
  amount: number;
  vatRate?: number;
  currency?: string;
  issueDate?: string | null;
  dueDate: string;
  paymentMethod?: string | null;
  category: string;
  source: string;
  notes?: string | null;
};

type UpdateInvoiceInput = {
  reference?: string;
  supplierReference?: string | null;
  supplierName?: string;
  amount?: number;
  vatRate?: number;
  currency?: string;
  issueDate?: string | null;
  dueDate?: string;
  paymentMethod?: string | null;
  category?: string;
  source?: string;
  notes?: string | null;
};

type SupplierInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  iban?: string | null;
  bic?: string | null;
  contactName?: string | null;
  vatNumber?: string | null;
  notes?: string | null;
  category?: string | null;
};

type UserInput = {
  email: string;
  fullName: string;
  role: string;
  password?: string;
};

function computeHt(amountTtc: number, vatRate: number) {
  const rate = vatRate || 0;
  const ht = amountTtc / (1 + rate / 100);
  const vat = amountTtc - ht;
  return {
    amountHt: Math.round(ht * 100) / 100,
    vatAmount: Math.round(vat * 100) / 100,
  };
}

type BudgetInput = {
  monthKey: string;
  monthLabel: string;
  purchaseBudget: number;
  expenseBudget: number;
  reserveAvailable: number;
};

async function addAuditLog(userId: string | null, invoiceId: string | null, action: string, message: string) {
  await prisma.auditLog.create({
    data: {
      userId: userId ?? undefined,
      invoiceId: invoiceId ?? undefined,
      action,
      message,
    },
  });
}

function serializeInvoice(invoice: any) {
  return {
    id: invoice.id,
    reference: invoice.reference,
    supplierReference: invoice.supplierReference ?? null,
    amount: Number(invoice.amount),
    amountHt: invoice.amountHt !== null && invoice.amountHt !== undefined ? Number(invoice.amountHt) : null,
    vatRate: Number(invoice.vatRate ?? 0),
    vatAmount: invoice.vatAmount !== null && invoice.vatAmount !== undefined ? Number(invoice.vatAmount) : null,
    currency: invoice.currency,
    issueDate: invoice.issueDate ? invoice.issueDate.toISOString() : null,
    dueDate: invoice.dueDate.toISOString(),
    paymentDate: invoice.paymentDate ? invoice.paymentDate.toISOString() : null,
    paymentMethod: invoice.paymentMethod ?? null,
    status: invoice.status,
    category: invoice.category,
    source: invoice.source,
    notes: invoice.notes,
    postponeReason: invoice.postponeReason,
    extractedByOcr: invoice.extractedByOcr,
    assignedTo: invoice.assignedToUser?.fullName ?? null,
    supplier: invoice.supplier
      ? {
          id: invoice.supplier.id,
          name: invoice.supplier.name,
          email: invoice.supplier.email,
          iban: invoice.supplier.iban ?? null,
          bic: invoice.supplier.bic ?? null,
        }
      : null,
    documents: (invoice.documents ?? []).map((doc: any) => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      uploadedAt: doc.uploadedAt.toISOString(),
      size: doc.originalSize,
    })),
  };
}

export async function getNextInvoiceReference(prefix = "FAC"): Promise<string> {
  const year = new Date().getFullYear();
  const key = `invoice_${year}`;
  const counter = await prisma.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  const number = String(counter.value).padStart(4, "0");
  return `${prefix}-${year}-${number}`;
}

async function resolveInvoicePrefix(): Promise<string> {
  const settings = await prisma.appSettings.findFirst();
  return settings?.invoicePrefix || "FAC";
}

export async function listInvoices() {
  const invoices = await prisma.invoice.findMany({
    include: { supplier: true, assignedToUser: true, documents: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });
  return invoices.map(serializeInvoice);
}

export async function getInvoiceById(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { supplier: true, assignedToUser: true, documents: true },
  });
  return invoice ? serializeInvoice(invoice) : null;
}

function serializeSupplier(s: any) {
  return {
    id: s.id,
    name: s.name,
    email: s.email ?? null,
    phone: s.phone ?? null,
    address: s.address ?? null,
    iban: s.iban ?? null,
    bic: s.bic ?? null,
    contactName: s.contactName ?? null,
    vatNumber: s.vatNumber ?? null,
    notes: s.notes ?? null,
    category: s.category ?? null,
  };
}

export async function listSuppliers() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return suppliers.map(serializeSupplier);
}

export async function getSupplierById(id: string) {
  const s = await prisma.supplier.findUnique({ where: { id } });
  return s ? serializeSupplier(s) : null;
}

export async function createSupplier(input: SupplierInput, userId: string | null) {
  const s = await prisma.supplier.create({
    data: {
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      iban: input.iban || null,
      bic: input.bic || null,
      contactName: input.contactName || null,
      vatNumber: input.vatNumber || null,
      notes: input.notes || null,
      category: input.category || null,
    },
  });
  await addAuditLog(userId, null, "SUPPLIER_CREATED", `Fournisseur ${input.name} cree.`);
  return serializeSupplier(s);
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>, userId: string | null) {
  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email || null;
  if (input.phone !== undefined) data.phone = input.phone || null;
  if (input.address !== undefined) data.address = input.address || null;
  if (input.iban !== undefined) data.iban = input.iban || null;
  if (input.bic !== undefined) data.bic = input.bic || null;
  if (input.contactName !== undefined) data.contactName = input.contactName || null;
  if (input.vatNumber !== undefined) data.vatNumber = input.vatNumber || null;
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.category !== undefined) data.category = input.category || null;
  const s = await prisma.supplier.update({ where: { id }, data });
  await addAuditLog(userId, null, "SUPPLIER_UPDATED", `Fournisseur ${s.name} modifie.`);
  return serializeSupplier(s);
}

export async function deleteSupplier(id: string, userId: string | null) {
  const count = await prisma.invoice.count({ where: { supplierId: id } });
  if (count > 0) throw new Error(`${count} facture(s) utilisent ce fournisseur. Impossible de supprimer.`);
  const s = await prisma.supplier.delete({ where: { id } });
  await addAuditLog(userId, null, "SUPPLIER_DELETED", `Fournisseur ${s.name} supprime.`);
  return { ok: true };
}

// ============ USERS ============

function serializeUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function listUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map(serializeUser);
}

export async function createUser(input: UserInput, actorId: string | null) {
  if (!input.password) throw new Error("Mot de passe requis");
  const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (existing) throw new Error("Cet email est deja utilise");
  const passwordHash = await bcrypt.hash(input.password, 10);
  const u = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      fullName: input.fullName,
      role: input.role,
      passwordHash,
    },
  });
  await addAuditLog(actorId, null, "USER_CREATED", `Utilisateur ${u.email} (${u.role}) cree.`);
  return serializeUser(u);
}

export async function updateUser(id: string, input: Partial<UserInput>, actorId: string | null) {
  const data: any = {};
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.role !== undefined) data.role = input.role;
  const u = await prisma.user.update({ where: { id }, data });
  await addAuditLog(actorId, null, "USER_UPDATED", `Utilisateur ${u.email} modifie.`);
  return serializeUser(u);
}

export async function resetUserPassword(id: string, newPassword: string, actorId: string | null) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  const u = await prisma.user.update({ where: { id }, data: { passwordHash } });
  await addAuditLog(actorId, null, "USER_PASSWORD_RESET", `Mot de passe de ${u.email} reinitialise par un admin.`);
  return serializeUser(u);
}

// ============ PAYMENTS ============

export async function listPayments(invoiceId: string) {
  const pays = await prisma.payment.findMany({ where: { invoiceId }, orderBy: { paidAt: "desc" } });
  return pays.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    currency: p.currency,
    paidAt: p.paidAt.toISOString(),
    method: p.method,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function addPayment(invoiceId: string, data: { amount: number; paidAt: string; method?: string | null; note?: string | null }, userId: string | null) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error("Facture introuvable");

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount: data.amount,
      currency: invoice.currency,
      paidAt: new Date(data.paidAt),
      method: data.method ?? null,
      note: data.note ?? null,
      createdBy: userId ?? null,
    },
  });

  // Calcul du total paye et bascule en PAYEE si complet
  const payments = await prisma.payment.findMany({ where: { invoiceId } });
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const totalDue = Number(invoice.amount);
  let newStatus = invoice.status;
  let newPaymentDate: Date | null = invoice.paymentDate;
  if (totalPaid >= totalDue - 0.005) {
    newStatus = "PAYEE";
    newPaymentDate = new Date(data.paidAt);
  } else if (totalPaid > 0 && invoice.status !== "REPORT_DEMANDE") {
    // garde le statut actuel si partiel
  }
  if (newStatus !== invoice.status || newPaymentDate !== invoice.paymentDate) {
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: newStatus, paymentDate: newPaymentDate } });
  }
  await addAuditLog(userId, invoiceId, "PAYMENT_ADDED", `Paiement de ${data.amount} ${invoice.currency} enregistre (total: ${totalPaid}/${totalDue}).`);
  return { payment, totalPaid, totalDue };
}

export async function deletePayment(paymentId: string, userId: string | null) {
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new Error("Paiement introuvable");
  await prisma.payment.delete({ where: { id: paymentId } });
  // Re-evaluation du statut
  const invoice = await prisma.invoice.findUnique({ where: { id: p.invoiceId } });
  if (invoice) {
    const remaining = await prisma.payment.findMany({ where: { invoiceId: p.invoiceId } });
    const totalPaid = remaining.reduce((s, x) => s + Number(x.amount), 0);
    if (totalPaid < Number(invoice.amount) && invoice.status === "PAYEE") {
      await prisma.invoice.update({ where: { id: p.invoiceId }, data: { status: "A_PAYER", paymentDate: null } });
    }
  }
  await addAuditLog(userId, p.invoiceId, "PAYMENT_DELETED", `Paiement de ${p.amount} supprime.`);
  return { ok: true };
}

export async function deleteUser(id: string, actorId: string | null) {
  if (id === actorId) throw new Error("Impossible de supprimer son propre compte");
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) throw new Error("Utilisateur introuvable");
  // Detacher les factures assignees
  await prisma.invoice.updateMany({ where: { assignedToUserId: id }, data: { assignedToUserId: null } });
  await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
  await prisma.user.delete({ where: { id } });
  await addAuditLog(actorId, null, "USER_DELETED", `Utilisateur ${u.email} supprime.`);
  return { ok: true };
}

export async function createInvoice(input: CreateInvoiceInput, userId: string | null) {
  const supplier = await prisma.supplier.upsert({
    where: { name: input.supplierName },
    update: {},
    create: { name: input.supplierName },
  });

  const vatRate = input.vatRate ?? 0;
  const { amountHt, vatAmount } = computeHt(input.amount, vatRate);

  // Auto-numbering si pas de reference fournie
  let reference = input.reference?.trim();
  if (!reference) {
    const prefix = await resolveInvoicePrefix();
    reference = await getNextInvoiceReference(prefix);
  }

  const invoice = await prisma.invoice.create({
    data: {
      reference,
      supplierReference: input.supplierReference ?? null,
      supplierId: supplier.id,
      amount: input.amount,
      amountHt,
      vatRate,
      vatAmount,
      currency: input.currency ?? "CHF",
      issueDate: input.issueDate ? new Date(input.issueDate) : null,
      dueDate: new Date(input.dueDate),
      paymentMethod: input.paymentMethod ?? null,
      status: "A_QUALIFIER",
      category: input.category,
      source: input.source,
      notes: input.notes ?? null,
      assignedToUserId: userId ?? undefined,
    },
    include: { supplier: true, assignedToUser: true, documents: true },
  });

  await addAuditLog(userId, invoice.id, "INVOICE_CREATED", `Facture ${reference} creee.`);

  return serializeInvoice(invoice);
}

export async function updateInvoice(invoiceId: string, input: UpdateInvoiceInput, userId: string | null) {
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) throw new Error("Facture introuvable");

  const data: any = {};

  if (input.supplierName) {
    const supplier = await prisma.supplier.upsert({
      where: { name: input.supplierName },
      update: {},
      create: { name: input.supplierName },
    });
    data.supplierId = supplier.id;
  }

  if (input.reference !== undefined) data.reference = input.reference;
  if (input.supplierReference !== undefined) data.supplierReference = input.supplierReference;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.issueDate !== undefined) data.issueDate = input.issueDate ? new Date(input.issueDate) : null;
  if (input.dueDate !== undefined) data.dueDate = new Date(input.dueDate);
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
  if (input.category !== undefined) data.category = input.category;
  if (input.source !== undefined) data.source = input.source;
  if (input.notes !== undefined) data.notes = input.notes;

  const nextAmount = input.amount ?? Number(existing.amount);
  const nextVatRate = input.vatRate ?? Number(existing.vatRate ?? 0);
  if (input.amount !== undefined || input.vatRate !== undefined) {
    const { amountHt, vatAmount } = computeHt(nextAmount, nextVatRate);
    data.amount = nextAmount;
    data.amountHt = amountHt;
    data.vatRate = nextVatRate;
    data.vatAmount = vatAmount;
  }

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data,
    include: { supplier: true, assignedToUser: true, documents: true },
  });

  await addAuditLog(userId, invoice.id, "INVOICE_UPDATED", `Facture ${invoice.reference} modifiee.`);
  return serializeInvoice(invoice);
}

export async function deleteInvoice(invoiceId: string, userId: string | null) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { documents: true },
  });
  if (!invoice) throw new Error("Facture introuvable");

  // Detach documents (SetNull in schema)
  await prisma.reminder.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
  await prisma.auditLog.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
  await prisma.invoiceDocument.updateMany({ where: { invoiceId }, data: { invoiceId: null } });
  await prisma.invoice.delete({ where: { id: invoiceId } });

  await addAuditLog(userId, null, "INVOICE_DELETED", `Facture ${invoice.reference} supprimee.`);
  return { ok: true };
}

export async function attachDocumentToInvoice(params: {
  invoiceId: string;
  filename: string;
  mimeType: string;
  storagePath: string;
  originalSize: number;
  userId: string | null;
}) {
  const doc = await prisma.invoiceDocument.create({
    data: {
      invoiceId: params.invoiceId,
      filename: params.filename,
      mimeType: params.mimeType,
      storagePath: params.storagePath,
      originalSize: params.originalSize,
    },
  });
  await addAuditLog(params.userId, params.invoiceId, "DOCUMENT_ATTACHED", `Document ${params.filename} attache.`);
  return doc;
}

export async function getDocumentById(id: string) {
  return prisma.invoiceDocument.findUnique({ where: { id } });
}

export async function deleteDocument(id: string, userId: string | null) {
  const doc = await prisma.invoiceDocument.findUnique({ where: { id } });
  if (!doc) throw new Error("Document introuvable");
  await prisma.invoiceDocument.delete({ where: { id } });
  await addAuditLog(userId, doc.invoiceId, "DOCUMENT_DELETED", `Document ${doc.filename} supprime.`);
  return doc;
}

export async function updateInvoiceStatus(invoiceId: string, status: string, userId: string | null) {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status },
    include: { supplier: true, assignedToUser: true, documents: true },
  });

  await addAuditLog(userId, invoice.id, "STATUS_UPDATED", `Statut passe a ${status}.`);
  return invoice;
}

export async function requestInvoicePostpone(invoiceId: string, reason: string, userId: string | null) {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "REPORT_DEMANDE",
      postponeReason: reason,
    },
  });

  await addAuditLog(userId, invoice.id, "POSTPONE_REQUESTED", `Report demande : ${reason}`);
  return invoice;
}

export async function markInvoicePaid(invoiceId: string, paymentDate: string, userId: string | null) {
  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "PAYEE",
      paymentDate: new Date(paymentDate),
      postponeReason: null,
    },
  });

  await addAuditLog(userId, invoice.id, "INVOICE_PAID", `Paiement confirme le ${paymentDate}.`);
  return invoice;
}

export async function getLatestBudget() {
  const budget = await prisma.budgetSnapshot.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!budget) return null;
  return {
    id: budget.id,
    monthKey: budget.monthKey,
    monthLabel: budget.monthLabel,
    purchaseBudget: Number(budget.purchaseBudget),
    expenseBudget: Number(budget.expenseBudget),
    reserveAvailable: Number(budget.reserveAvailable),
  };
}

export async function upsertBudget(input: BudgetInput) {
  const budget = await prisma.budgetSnapshot.upsert({
    where: { monthKey: input.monthKey },
    update: {
      monthLabel: input.monthLabel,
      purchaseBudget: input.purchaseBudget,
      expenseBudget: input.expenseBudget,
      reserveAvailable: input.reserveAvailable,
    },
    create: {
      monthKey: input.monthKey,
      monthLabel: input.monthLabel,
      purchaseBudget: input.purchaseBudget,
      expenseBudget: input.expenseBudget,
      reserveAvailable: input.reserveAvailable,
    },
  });

  return {
    id: budget.id,
    monthKey: budget.monthKey,
    monthLabel: budget.monthLabel,
    purchaseBudget: Number(budget.purchaseBudget),
    expenseBudget: Number(budget.expenseBudget),
    reserveAvailable: Number(budget.reserveAvailable),
  };
}

export async function listReminders() {
  const reminders = await prisma.reminder.findMany({
    include: { invoice: true },
    where: { isCompleted: false },
    orderBy: { dueAt: "asc" },
    take: 10,
  });

  return reminders.map((reminder) => ({
    id: reminder.id,
    message: reminder.message,
    dueAt: reminder.dueAt.toISOString(),
    invoiceReference: reminder.invoice?.reference ?? null,
  }));
}

export async function listAuditLogs() {
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    message: log.message,
    createdAt: log.createdAt.toISOString(),
    userName: log.user?.fullName ?? null,
  }));
}
