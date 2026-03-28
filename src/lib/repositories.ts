import { prisma } from "@/lib/db";

type CreateInvoiceInput = {
  reference: string;
  supplierName: string;
  amount: number;
  dueDate: string;
  category: string;
  source: string;
};

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

export async function listInvoices() {
  const invoices = await prisma.invoice.findMany({
    include: {
      supplier: true,
      assignedToUser: true,
      documents: true,
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
    reference: invoice.reference,
    amount: Number(invoice.amount),
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
    supplier: {
      id: invoice.supplier.id,
      name: invoice.supplier.name,
      email: invoice.supplier.email,
    },
    documents: invoice.documents.map((document) => ({
      id: document.id,
      filename: document.filename,
      mimeType: document.mimeType,
      uploadedAt: document.uploadedAt.toISOString(),
    })),
  }));
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

  const invoice = await prisma.invoice.create({
    data: {
      reference: input.reference,
      supplierId: supplier.id,
      amount: input.amount,
      dueDate: new Date(input.dueDate),
      status: "A_QUALIFIER",
      category: input.category,
      source: input.source,
      assignedToUserId: userId ?? undefined,
    },
    include: { supplier: true, assignedToUser: true, documents: true },
  });

  await addAuditLog(userId, invoice.id, "INVOICE_CREATED", `Facture ${input.reference} creee.`);

  return {
    id: invoice.id,
    reference: invoice.reference,
    amount: Number(invoice.amount),
    currency: invoice.currency,
    dueDate: invoice.dueDate.toISOString(),
    paymentDate: invoice.paymentDate ? invoice.paymentDate.toISOString() : null,
    status: invoice.status,
    category: invoice.category,
    source: invoice.source,
    postponeReason: invoice.postponeReason,
    supplier: { id: invoice.supplier.id, name: invoice.supplier.name, email: invoice.supplier.email },
    assignedTo: invoice.assignedToUser?.fullName ?? null,
    documents: [],
  };
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
