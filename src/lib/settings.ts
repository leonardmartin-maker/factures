import { prisma } from "@/lib/db";

export type AppSettingsData = {
  id: string;
  companyName: string | null;
  companyVat: string | null;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  companyLogo: string | null;
  defaultCurrency: string;
  defaultVatRate: number;
  invoicePrefix: string;
  overdueReminders: boolean;
};

export async function getSettings(): Promise<AppSettingsData> {
  let s = await prisma.appSettings.findFirst();
  if (!s) {
    s = await prisma.appSettings.create({ data: {} });
  }
  return {
    id: s.id,
    companyName: s.companyName,
    companyVat: s.companyVat,
    companyAddress: s.companyAddress,
    companyEmail: s.companyEmail,
    companyPhone: s.companyPhone,
    companyLogo: s.companyLogo,
    defaultCurrency: s.defaultCurrency,
    defaultVatRate: Number(s.defaultVatRate),
    invoicePrefix: s.invoicePrefix,
    overdueReminders: s.overdueReminders,
  };
}

export async function updateSettings(data: Partial<AppSettingsData>): Promise<AppSettingsData> {
  const current = await getSettings();
  const updated = await prisma.appSettings.update({
    where: { id: current.id },
    data: {
      companyName: data.companyName ?? undefined,
      companyVat: data.companyVat ?? undefined,
      companyAddress: data.companyAddress ?? undefined,
      companyEmail: data.companyEmail ?? undefined,
      companyPhone: data.companyPhone ?? undefined,
      companyLogo: data.companyLogo ?? undefined,
      defaultCurrency: data.defaultCurrency,
      defaultVatRate: data.defaultVatRate,
      invoicePrefix: data.invoicePrefix,
      overdueReminders: data.overdueReminders,
    },
  });
  return {
    id: updated.id,
    companyName: updated.companyName,
    companyVat: updated.companyVat,
    companyAddress: updated.companyAddress,
    companyEmail: updated.companyEmail,
    companyPhone: updated.companyPhone,
    companyLogo: updated.companyLogo,
    defaultCurrency: updated.defaultCurrency,
    defaultVatRate: Number(updated.defaultVatRate),
    invoicePrefix: updated.invoicePrefix,
    overdueReminders: updated.overdueReminders,
  };
}
