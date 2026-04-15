import { prisma } from "@/lib/db";

type CreateInvoiceInput = {
  reference: string;
  supplierName: string;
  amount: number;
  vatRate?: number;
  dueDate: string;
  category: string;
  source: string;
  notes?: string | null;
};

type UpdateInvoiceInput = {
  reference?: string;
  supplierName?: string;
  amount?: number;
  vatRate?: number;
  dueDate?: string;
  category?: string;
  source?: string;
  notes?: string | null;
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
    amount: Number(invoice.amount),
    amountHt: invoice.amountHt !== null && invoice.amountHt !== undefined ? Number(invoice.amountHt) : null,
    vatRate: Number(invoice.vatRate ?? 0),
    vatAmount: invoice.vatAmount !== null && invoice.vatAmount !== undefined ? Number(invoice.vatAmount) : null,
    currency: invoice.currency,
    dueDate: invoice.dueDate.toISOString(),
    paymentDate: invoice.paymentDate ? invoice.paymentDate.toISOString() : null,
    status: invoice.status,
    category: invoice.category,
    source: invoice.source,
    notes: invoice.notes,
    postponeReason: invoice.postponeReason,
    extractedByOcr: invoice.extractedByOcr,
    assignedTo: invoice.assignedToUser?.fullName ?? null,
    supplier: invoice.supplier
      ? { id: invoice.supplier.id, name: invoice.supplier.name, email: invoice.supplier.email }
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

export async function listSuppliers() {
  const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
  return suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    category: supplier.category,
  }));
}

export async function createInvoice(input: CreateInvoiceInput, userId: string | null) {
  const supplier = await prisma.supplier.upsert({
    where: { name: input.supplierName },
    update: {},
    create: { name: input.supplierName },
  });

  const vatRate = input.vatRate ?? 0;
  const { amountHt, vatAmount } = computeHt(input.amount, vatRate);

  const invoice = await prisma.invoice.create({
    data: {
      reference: input.reference,
      supplierId: supplier.id,
      amount: input.amount,
      amountHt,
      vatRate,
      vatAmount,
      dueDate: new Date(input.dueDate),
      status: "A_QUALIFIER",
      category: input.category,
      source: input.source,
      notes: input.notes ?? null,
      assignedToUserId: userId ?? undefined,
    },
    include: { supplier: true, assignedToUser: true, documents: true },
  });

  await addAuditLog(userId, invoice.id, "INVOICE_CREATED", `Facture ${input.reference} creee.`);

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
  if (input.dueDate !== undefined) data.dueDate = new Date(input.dueDate);
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
