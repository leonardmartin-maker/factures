/**
 * Email helper - utilise nodemailer si SMTP_HOST configure, sinon log.
 * Variables d'env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE ("true"/"false")
 */
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  return transporter;
}

export async function sendMail(params: { to: string; subject: string; html: string; text?: string }): Promise<{ ok: boolean; error?: string; logOnly?: boolean }> {
  const from = process.env.SMTP_FROM ?? "no-reply@factures.local";
  const t = getTransporter();
  if (!t) {
    console.log(`[email] SMTP non configure. Simulation envoi vers ${params.to}: "${params.subject}"`);
    return { ok: true, logOnly: true };
  }
  try {
    await t.sendMail({ from, to: params.to, subject: params.subject, html: params.html, text: params.text });
    return { ok: true };
  } catch (e: any) {
    console.error("[email] Erreur envoi:", e.message);
    return { ok: false, error: e.message };
  }
}

export function renderOverdueEmail(userName: string, invoices: Array<{ reference: string; supplierName: string; amount: number; currency: string; dueDate: string; daysOverdue: number }>, appUrl: string) {
  const total = invoices.reduce((s, i) => s + i.amount, 0);
  const rows = invoices.map((i) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0"><strong>${i.reference}</strong></td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.supplierName}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${i.amount.toFixed(2)} ${i.currency}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#dc2626">${i.daysOverdue}j en retard</td>
    </tr>
  `).join("");
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#0f172a;margin:0 0 8px">Factures en retard</h2>
      <p style="color:#64748b;margin:0 0 20px">Bonjour ${userName}, voici ${invoices.length} facture(s) en retard au ${new Date().toLocaleDateString("fr-CH")}:</p>
      <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px;text-align:left">Ref</th><th style="padding:8px;text-align:left">Fournisseur</th>
          <th style="padding:8px;text-align:right">Montant</th><th style="padding:8px;text-align:left">Statut</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px"><strong>Total du a payer : ${invoices.map((i) => i.currency).filter((v, i, a) => a.indexOf(v) === i).join("/")} ${total.toFixed(2)}</strong></p>
      <p><a href="${appUrl}" style="display:inline-block;background:#0f172a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:12px">Voir les factures</a></p>
    </div>
  `;
  return { html, text: `Factures en retard: ${invoices.length} facture(s). ${appUrl}` };
}

export function renderResetPasswordEmail(resetUrl: string) {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#0f172a">Reinitialisation du mot de passe</h2>
      <p>Vous avez demande a reinitialiser votre mot de passe Factures Pro. Cliquez sur le lien ci-dessous (valable 1 heure):</p>
      <p><a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Reinitialiser mon mot de passe</a></p>
      <p style="color:#64748b;font-size:13px">Si vous n'avez pas demande cela, ignorez cet email.</p>
    </div>
  `;
  return { html, text: `Reinitialisation: ${resetUrl}` };
}
