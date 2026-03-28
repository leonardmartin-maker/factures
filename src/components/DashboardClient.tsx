"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionPayload } from "@/lib/auth";
import type { DashboardData } from "@/lib/dashboard";

const categories = ["ASSURANCE", "ACHATS", "ESSENCE", "LOYER", "TELECOM", "LOGICIELS", "FOURNITURES", "TRANSPORT", "AUTRES"];
const statuses = ["A_QUALIFIER", "A_VALIDER", "A_PAYER", "REPORT_DEMANDE", "PAYEE", "ARCHIVEE"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function statusBadge(status: string) {
  if (status === "PAYEE") return "green";
  if (status === "REPORT_DEMANDE") return "orange";
  if (status === "ARCHIVEE") return "gray";
  if (status === "A_PAYER") return "blue";
  return "gray";
}

export default function DashboardClient({ initialData, session }: { initialData: DashboardData; session: SessionPayload }) {
  const [data, setData] = useState(initialData);
  const [supplierName, setSupplierName] = useState(initialData.suppliers[0]?.name ?? "");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState("2026-04-10");
  const [category, setCategory] = useState("ACHATS");
  const [source, setSource] = useState("PDF");
  const [postponeReason, setPostponeReason] = useState("Besoin de decalage de tresorerie");
  const [budgetForm, setBudgetForm] = useState({
    monthKey: initialData.budget?.monthKey ?? "2026-03",
    monthLabel: initialData.budget?.monthLabel ?? "Mars 2026",
    purchaseBudget: String(initialData.budget?.purchaseBudget ?? 7000),
    expenseBudget: String(initialData.budget?.expenseBudget ?? 5200),
    reserveAvailable: String(initialData.budget?.reserveAvailable ?? 4600),
  });
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const refreshData = async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    const next = await response.json();
    setData(next);
    router.refresh();
  };

  const submitInvoice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading("invoice");

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference,
        supplierName,
        amount: Number(amount),
        dueDate,
        category,
        source,
      }),
    });

    if (response.ok) {
      setReference("");
      setAmount("0");
      await refreshData();
    }

    setLoading(null);
  };

  const updateBudget = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading("budget");

    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        monthKey: budgetForm.monthKey,
        monthLabel: budgetForm.monthLabel,
        purchaseBudget: Number(budgetForm.purchaseBudget),
        expenseBudget: Number(budgetForm.expenseBudget),
        reserveAvailable: Number(budgetForm.reserveAvailable),
      }),
    });

    await refreshData();
    setLoading(null);
  };

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setLoading("upload");
    const response = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await response.json();
    if (response.ok) {
      setUploadMessage(`Fichier importe. OCR detecte: ${result.analysis.supplierName} / ${result.analysis.amount} EUR / echeance ${result.analysis.dueDate}`);
    } else {
      setUploadMessage(result.error ?? "Import impossible");
    }
    setLoading(null);
  };

  const payInvoice = async (invoiceId: string) => {
    setLoading(invoiceId);
    await fetch(`/api/invoices/${invoiceId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentDate: new Date().toISOString().slice(0, 10) }),
    });
    await refreshData();
    setLoading(null);
  };

  const requestPostpone = async (invoiceId: string) => {
    setLoading(invoiceId);
    await fetch(`/api/invoices/${invoiceId}/postpone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: postponeReason }),
    });
    await refreshData();
    setLoading(null);
  };

  const changeStatus = async (invoiceId: string, nextStatus: string) => {
    setLoading(invoiceId);
    await fetch(`/api/invoices/${invoiceId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    await refreshData();
    setLoading(null);
  };

  const budgetRatios = useMemo(() => {
    const purchase = data.stats.totalPurchases / Math.max(data.budget?.purchaseBudget ?? 1, 1) * 100;
    const expense = data.stats.totalExpenses / Math.max(data.budget?.expenseBudget ?? 1, 1) * 100;
    const reserve = (data.budget?.reserveAvailable ?? 0) / Math.max(data.budget?.expenseBudget ?? 1, 1) * 100;
    return {
      purchase: Math.min(purchase, 100),
      expense: Math.min(expense, 100),
      reserve: Math.min(reserve, 100),
    };
  }, [data]);

  return (
    <div className="stack">
      <section className="grid grid-4">
        <div className="card" style={{ padding: 18 }}>
          <div className="small muted">Factures a payer</div>
          <div className="stat-value">{formatCurrency(data.stats.totalToPay)}</div>
          <div className="tiny muted">Vision immediate sur les echeances</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="small muted">Factures payees</div>
          <div className="stat-value">{formatCurrency(data.stats.totalPaid)}</div>
          <div className="tiny muted">Historique des reglements</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="small muted">En retard</div>
          <div className="stat-value">{data.stats.overdueCount}</div>
          <div className="tiny muted">Demandes a traiter rapidement</div>
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="small muted">Reserve disponible</div>
          <div className="stat-value">{formatCurrency(data.budget?.reserveAvailable ?? 0)}</div>
          <div className="tiny muted">Marge de securite tresorerie</div>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Nouvelle facture</div>
          <p className="small muted">Import manuel rapide pour alimenter le workflow sans papier.</p>
          <form className="stack" onSubmit={submitInvoice} style={{ marginTop: 14 }}>
            <input className="input" placeholder="Reference facture" value={reference} onChange={(event) => setReference(event.target.value)} />
            <select className="select" value={supplierName} onChange={(event) => setSupplierName(event.target.value)}>
              {data.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.name}>{supplier.name}</option>
              ))}
            </select>
            <div className="grid grid-2">
              <input className="input" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
              <input className="input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="grid grid-2">
              <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="PDF">PDF</option>
                <option value="SCAN">SCAN</option>
                <option value="EMAIL">EMAIL</option>
                <option value="MANUEL">MANUEL</option>
              </select>
            </div>
            <button className="button" disabled={loading === "invoice"}>{loading === "invoice" ? "Enregistrement..." : "Creer la facture"}</button>
          </form>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Import scan / PDF</div>
          <p className="small muted">Le document est stocke localement puis pre-analyse par un OCR simule.</p>
          <div className="stack" style={{ marginTop: 14 }}>
            <input className="input" type="file" onChange={uploadFile} />
            {uploadMessage ? <div className="badge blue" style={{ whiteSpace: "normal" }}>{uploadMessage}</div> : null}
            <div className="card" style={{ padding: 14, background: "#f8fafc" }}>
              <strong className="small">Astuce</strong>
              <div className="small muted" style={{ marginTop: 8 }}>
                La route d'upload est volontairement simple pour etre remplacee ensuite par S3, R2 ou MinIO.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-2">
        <div className="card" style={{ padding: 20 }}>
          <div className="space-between">
            <div>
              <div className="section-title">Budget et reserve</div>
              <div className="small muted">Pilotage achats, depenses et marge de securite</div>
            </div>
            <a className="button secondary" href="/api/invoices/export">Exporter CSV</a>
          </div>

          <div className="stack" style={{ marginTop: 16 }}>
            <div>
              <div className="space-between small"><span>Budget achats</span><strong>{formatCurrency(data.stats.totalPurchases)} / {formatCurrency(data.budget?.purchaseBudget ?? 0)}</strong></div>
              <div className="progress"><span style={{ width: `${budgetRatios.purchase}%` }} /></div>
            </div>
            <div>
              <div className="space-between small"><span>Budget depenses</span><strong>{formatCurrency(data.stats.totalExpenses)} / {formatCurrency(data.budget?.expenseBudget ?? 0)}</strong></div>
              <div className="progress"><span style={{ width: `${budgetRatios.expense}%` }} /></div>
            </div>
            <div>
              <div className="space-between small"><span>Reserve</span><strong>{formatCurrency(data.budget?.reserveAvailable ?? 0)}</strong></div>
              <div className="progress"><span style={{ width: `${budgetRatios.reserve}%` }} /></div>
            </div>
          </div>

          <form className="stack" onSubmit={updateBudget} style={{ marginTop: 18 }}>
            <div className="grid grid-2">
              <input className="input" value={budgetForm.monthKey} onChange={(event) => setBudgetForm((current) => ({ ...current, monthKey: event.target.value }))} />
              <input className="input" value={budgetForm.monthLabel} onChange={(event) => setBudgetForm((current) => ({ ...current, monthLabel: event.target.value }))} />
            </div>
            <div className="grid grid-2">
              <input className="input" type="number" step="0.01" value={budgetForm.purchaseBudget} onChange={(event) => setBudgetForm((current) => ({ ...current, purchaseBudget: event.target.value }))} />
              <input className="input" type="number" step="0.01" value={budgetForm.expenseBudget} onChange={(event) => setBudgetForm((current) => ({ ...current, expenseBudget: event.target.value }))} />
            </div>
            <input className="input" type="number" step="0.01" value={budgetForm.reserveAvailable} onChange={(event) => setBudgetForm((current) => ({ ...current, reserveAvailable: event.target.value }))} />
            <button className="button" disabled={loading === "budget"}>{loading === "budget" ? "Sauvegarde..." : "Mettre a jour le budget"}</button>
          </form>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div className="section-title">Rappels et audit</div>
          <div className="small muted">Trace des actions sensibles et alertes a venir</div>

          <div className="stack" style={{ marginTop: 16 }}>
            {data.reminders.map((reminder) => (
              <div className="card" key={reminder.id} style={{ padding: 14, background: "#f8fafc" }}>
                <div style={{ fontWeight: 700 }}>{reminder.message}</div>
                <div className="tiny muted">A faire le {formatDate(reminder.dueAt)}{reminder.invoiceReference ? ` · ${reminder.invoiceReference}` : ""}</div>
              </div>
            ))}
            {data.auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="small" style={{ borderLeft: "3px solid #cbd5e1", paddingLeft: 12 }}>
                <strong>{log.action}</strong> · {log.message}
                <div className="tiny muted">{formatDate(log.createdAt)} · {log.userName ?? "Systeme"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 20 }}>
        <div className="space-between">
          <div>
            <div className="section-title">Factures</div>
            <div className="small muted">Actions rapides sur le workflow : valider, payer, demander un report, archiver</div>
          </div>
          <div className="badge gray">Connecte en {session.role}</div>
        </div>

        <div className="stack" style={{ marginTop: 16 }}>
          <label className="stack small">
            <span>Motif par defaut pour les reports</span>
            <input className="input" value={postponeReason} onChange={(event) => setPostponeReason(event.target.value)} />
          </label>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Fournisseur</th>
                  <th>Montant</th>
                  <th>Echeance</th>
                  <th>Statut</th>
                  <th>Compta</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.reference}</strong>
                      <div className="tiny muted">{invoice.source} · {invoice.assignedTo ?? "Non assignee"}</div>
                    </td>
                    <td>{invoice.supplier.name}</td>
                    <td>{formatCurrency(invoice.amount)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td>
                      <span className={`badge ${statusBadge(invoice.status)}`}>{invoice.status}</span>
                      {invoice.postponeReason ? <div className="tiny muted" style={{ marginTop: 6 }}>{invoice.postponeReason}</div> : null}
                    </td>
                    <td>{invoice.category}</td>
                    <td>
                      <div className="row">
                        {invoice.status !== "PAYEE" ? <button className="button success" onClick={() => payInvoice(invoice.id)} disabled={loading === invoice.id}>Payer</button> : null}
                        {invoice.status !== "REPORT_DEMANDE" && invoice.status !== "PAYEE" ? <button className="button warning" onClick={() => requestPostpone(invoice.id)} disabled={loading === invoice.id}>Report</button> : null}
                        <select className="select" value={invoice.status} onChange={(event) => changeStatus(invoice.id, event.target.value)} style={{ minWidth: 170 }}>
                          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </div>
                      {invoice.paymentDate ? <div className="tiny muted" style={{ marginTop: 8 }}>Payee le {formatDate(invoice.paymentDate)}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
