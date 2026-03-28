import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.invoiceDocument.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.budgetSnapshot.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo123", 10);

  const [admin, accounting, manager] = await Promise.all([
    prisma.user.create({
      data: { email: "admin@entreprise.local", fullName: "Admin Demo", role: "ADMIN", passwordHash },
    }),
    prisma.user.create({
      data: { email: "compta@entreprise.local", fullName: "Comptabilite Demo", role: "ACCOUNTING", passwordHash },
    }),
    prisma.user.create({
      data: { email: "manager@entreprise.local", fullName: "Manager Demo", role: "MANAGER", passwordHash },
    }),
  ]);

  const [axa, total, orange, bureau] = await Promise.all([
    prisma.supplier.create({ data: { name: "AXA Entreprises", email: "contact@axa.example", category: "Assurance" } }),
    prisma.supplier.create({ data: { name: "Station Total", category: "Transport" } }),
    prisma.supplier.create({ data: { name: "Orange Pro", category: "Telecom" } }),
    prisma.supplier.create({ data: { name: "Bureau Vallee", category: "Fournitures" } }),
  ]);

  const invoices = await Promise.all([
    prisma.invoice.create({
      data: {
        reference: "FAC-2026-001",
        supplierId: axa.id,
        amount: 1240,
        dueDate: new Date("2026-04-05"),
        status: "A_PAYER",
        category: "ASSURANCE",
        source: "PDF",
        notes: "Contrat annuel assurance flotte.",
        assignedToUserId: accounting.id,
      },
    }),
    prisma.invoice.create({
      data: {
        reference: "FAC-2026-002",
        supplierId: total.id,
        amount: 289,
        dueDate: new Date("2026-04-01"),
        status: "REPORT_DEMANDE",
        category: "ESSENCE",
        source: "SCAN",
        postponeReason: "Decalage de tresorerie fin de mois.",
        assignedToUserId: manager.id,
        extractedByOcr: true,
      },
    }),
    prisma.invoice.create({
      data: {
        reference: "FAC-2026-003",
        supplierId: orange.id,
        amount: 199,
        dueDate: new Date("2026-03-14"),
        paymentDate: new Date("2026-03-13"),
        status: "PAYEE",
        category: "TELECOM",
        source: "EMAIL",
        assignedToUserId: accounting.id,
      },
    }),
    prisma.invoice.create({
      data: {
        reference: "FAC-2026-004",
        supplierId: bureau.id,
        amount: 472,
        dueDate: new Date("2026-03-20"),
        status: "A_VALIDER",
        category: "FOURNITURES",
        source: "PDF",
        assignedToUserId: admin.id,
      },
    }),
  ]);

  await prisma.budgetSnapshot.create({
    data: {
      monthKey: "2026-03",
      monthLabel: "Mars 2026",
      purchaseBudget: 7000,
      expenseBudget: 5200,
      reserveAvailable: 4600,
    },
  });

  await prisma.reminder.createMany({
    data: [
      { invoiceId: invoices[0].id, message: "Verifier le paiement AXA avant echeance.", dueAt: new Date("2026-04-03") },
      { invoiceId: invoices[1].id, message: "Relancer le fournisseur pour report.", dueAt: new Date("2026-03-29") },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, invoiceId: invoices[0].id, action: "INVOICE_CREATED", message: "Facture importee dans le systeme." },
      { userId: manager.id, invoiceId: invoices[1].id, action: "POSTPONE_REQUESTED", message: "Demande de report enregistree." },
      { userId: accounting.id, invoiceId: invoices[2].id, action: "INVOICE_PAID", message: "Paiement confirme et historise." },
    ],
  });

  console.log("Seed complete: 3 users, 4 suppliers, 4 invoices, 2 reminders, 3 audit logs, 1 budget");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
