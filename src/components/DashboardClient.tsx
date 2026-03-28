"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionPayload } from "@/lib/auth";
import type { DashboardData } from "@/lib/dashboard";

const CATEGORY_LABELS: Record<string, string> = {
  ASSURANCE: "Assurance",
  ACHATS: "Achats",
  ESSENCE: "Essence",
  LOYER: "Loyer",
  TELECOM: "Telecom",
  LOGICIELS: "Logiciels",
  FOURNITURES: "Fournitures",
  TRANSPORT: "Transport",
  AUTRES: "Autres",
};

const STATUS_LABELS: Record<string, string> = {
  A_QUALIFIER: "A qualifier",
  A_VALIDER: "A valider",
  A_PAYER: "A payer",
  REPORT_DEMANDE: "Report demande",
  PAYEE: "Payee",
  ARCHIVEE: "Archivee",
};

const STATUS_CLASS: Record<string, string> = {
  A_QUALIFIER: "qualifier",
  A_VALIDER: "valider",
  A_PAYER: "payer",
  REPORT_DEMANDE: "report",
  PAYEE: "payee",
  ARCHIVEE: "archivee",
};

const categories = Object.keys(CATEGORY_LABELS);
const statuses = Object.keys(STATUS_LABELS);
const sources = ["PDF", "SCAN", "EMAIL", "MANUEL"];

function fmt(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function fmtDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function DashboardClient({ initialData, session }: { initialData: DashboardData; session: SessionPayload }) {
  const [data, setData] = useState(initialData);
  const [supplierName, setSupplierName] = useState(initialData.suppliers[0]?.name ?? "");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  const [category, setCategory] = useState("ACHATS");
  const [source, setSource] = useState("PDF");
  const [postponeReason, setPostponeReason] = useState("Besoin de decalage de tresorerie");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [budgetForm, setBudgetForm] = useState({
    monthKey: initialData.budget?.monthKey ?? "2026-03",
    monthLabel: initialData.budget?.monthLabel ?? "Mars 2026",
    purchaseBudget: String(initialData.budget?.purchaseBudget ?? 7000),
    expenseBudget: String(initialData.budget?.expenseBudget ?? 5200),
    reserveAvailable: String(initialData.budget?.reserveAvailable ?? 4600),
  });
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const refreshData = async () => {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    setData(await res.json());
    router.refresh();
  };

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredInvoices = useMemo(() => {
    let list = data.invoices;
    if (statusFilter !== "ALL") list = list.filter((i) => i.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) =>
        [i.reference, i.supplier.name, i.category, i.assignedTo ?? ""].join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data.invoices, statusFilter, searchQuery]);

  const submitInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading("invoice");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, supplierName, amount: Number(amount), dueDate, category, source }),
    });
    if (res.ok) {
      setReference("");
      setAmount("");
      await refreshData();
      showMessage("Facture creee avec succes");
    }
    setLoading(null);
  };

  const updateBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
    showMessage("Budget mis a jour");
    setLoading(null);
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setLoading("upload");
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const result = await res.json();
    if (res.ok) {
      setUploadMessage(`OCR : ${result.analysis.supplierName} - ${fmt(result.analysis.amount)} - echeance ${fmtDate(result.analysis.dueDate)}`);
      await refreshData();
    } else {
      setUploadMessage(result.error ?? "Erreur d'import");
    }
    setLoading(null);
  };

  const payInvoice = async (id: string) => {
    setLoading(id);
    await fetch(`/api/invoices/${id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentDate: new Date().toISOString().slice(0, 10) }),
    });
    await refreshData();
    showMessage("Facture marquee comme payee");
    setLoading(null);
  };

  const requestPostpone = async (id: string) => {
    setLoading(id);
    await fetch(`/api/invoices/${id}/postpone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: postponeReason }),
    });
    await refreshData();
    showMessage("Demande de report enregistree");
    setLoading(null);
  };

  const changeStatus = async (id: string, next: string) => {
    setLoading(id);
    await fetch(`/api/invoices/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await refreshData();
    setLoading(null);
  };

  const ratios = useMemo(() => {
    const p = data.stats.totalPurchases / Math.max(data.budget?.purchaseBudget ?? 1, 1) * 100;
    const e = data.stats.totalExpenses / Math.max(data.budget?.expenseBudget ?? 1, 1) * 100;
    const r = (data.budget?.reserveAvailable ?? 0) / Math.max(data.budget?.expenseBudget ?? 1, 1) * 100;
    return { purchase: Math.min(p, 100), expense: Math.min(e, 100), reserve: Math.min(r, 100) };
  }, [data]);

  return (
    <div className="stack">
      {message && (
        <div className="badge green" style={{ padding: "10px 16px", fontSize: 14, alignSelf: "flex-start" }}>
          {message}
        </div>
      )}

      {/* Stats */}
      <section className="grid grid-4">
        <div className="card stat-card accent-blue">
          <div className="stat-label">A payer</div>
          <div className="stat-value">{fmt(data.stats.totalToPay)}</div>
          <div className="stat-hint">Echeances en cours</div>
        </div>
        <div className="card stat-card accent-green">
          <div className="stat-label">Payees</div>
          <div className="stat-value">{fmt(data.stats.totalPaid)}</div>
          <div className="stat-hint">Reglements effectues</div>
        </div>
        <div className="card stat-card accent-red">
          <div className="stat-label">En retard</div>
          <div className="stat-value">{data.stats.overdueCount}</div>
          <div className="stat-hint">A traiter en priorite</div>
        </div>
        <div className="card stat-card accent-purple">
          <div className="stat-label">Reserve</div>
          <div className="stat-value">{fmt(data.budget?.reserveAvailable ?? 0)}</div>
          <div className="stat-hint">Marge de securite</div>
        </div>
      </section>

      {/* Forms */}
      <section className="grid grid-2">
        <div className="card card-inner">
          <div className="section-title">Nouvelle facture</div>
          <p className="small muted" style={{ margin: "4px 0 14px" }}>Saisie manuelle pour alimenter le workflow.</p>
          <form className="stack-sm" onSubmit={submitInvoice}>
            <input className="input" placeholder="Reference (ex: FAC-2026-005)" value={reference} onChange={(e) => setReference(e.target.value)} />
            <select className="select" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}>
              {data.suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <div className="grid grid-2">
              <input className="input" type="number" min="0" step="0.01" placeholder="Montant" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="grid grid-2">
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button className="button" disabled={loading === "invoice"}>{loading === "invoice" ? "Enregistrement..." : "Creer la facture"}</button>
          </form>
        </div>

        <div className="card card-inner">
          <div className="section-title">Import scan / PDF</div>
          <p className="small muted" style={{ margin: "4px 0 14px" }}>Analyse OCR simulee a partir du fichier.</p>
          <div className="stack-sm">
            <input className="input" type="file" accept="image/*,.pdf" onChange={uploadFile} disabled={loading === "upload"} />
            {uploadMessage && <div className="badge blue" style={{ whiteSpace: "normal", padding: "8px 12px" }}>{uploadMessage}</div>}
          </div>
        </div>
      </section>

      {/* Budget + Rappels */}
      <section className="grid grid-2">
        <div className="card card-inner">
          <div className="space-between" style={{ marginBottom: 16 }}>
            <div>
              <div className="section-title">Budget et reserve</div>
              <div className="small muted">Pilotage achats, depenses et tresorerie</div>
            </div>
            <a className="button secondary sm" href="/api/invoices/export">Exporter CSV</a>
          </div>

          <div className="stack-sm" style={{ marginBottom: 18 }}>
            <div>
              <div className="space-between tiny"><span className="muted">Achats</span><strong>{fmt(data.stats.totalPurchases)} / {fmt(data.budget?.purchaseBudget ?? 0)}</strong></div>
              <div className="progress"><span className="bar-blue" style={{ width: `${ratios.purchase}%` }} /></div>
            </div>
            <div>
              <div className="space-between tiny"><span className="muted">Depenses</span><strong>{fmt(data.stats.totalExpenses)} / {fmt(data.budget?.expenseBudget ?? 0)}</strong></div>
              <div className="progress"><span className="bar-default" style={{ width: `${ratios.expense}%` }} /></div>
            </div>
            <div>
              <div className="space-between tiny"><span className="muted">Reserve</span><strong>{fmt(data.budget?.reserveAvailable ?? 0)}</strong></div>
              <div className="progress"><span className="bar-green" style={{ width: `${ratios.reserve}%` }} /></div>
            </div>
          </div>

          <form className="stack-sm" onSubmit={updateBudget}>
            <div className="grid grid-2">
              <div><div className="label">Cle mois</div><input className="input" value={budgetForm.monthKey} onChange={(e) => setBudgetForm((c) => ({ ...c, monthKey: e.target.value }))} /></div>
              <div><div className="label">Libelle</div><input className="input" value={budgetForm.monthLabel} onChange={(e) => setBudgetForm((c) => ({ ...c, monthLabel: e.target.value }))} /></div>
            </div>
            <div className="grid grid-3">
              <div><div className="label">Achats</div><input className="input" type="number" step="0.01" value={budgetForm.purchaseBudget} onChange={(e) => setBudgetForm((c) => ({ ...c, purchaseBudget: e.target.value }))} /></div>
              <div><div className="label">Depenses</div><input className="input" type="number" step="0.01" value={budgetForm.expenseBudget} onChange={(e) => setBudgetForm((c) => ({ ...c, expenseBudget: e.target.value }))} /></div>
              <div><div className="label">Reserve</div><input className="input" type="number" step="0.01" value={budgetForm.reserveAvailable} onChange={(e) => setBudgetForm((c) => ({ ...c, reserveAvailable: e.target.value }))} /></div>
            </div>
            <button className="button" disabled={loading === "budget"}>{loading === "budget" ? "Sauvegarde..." : "Mettre a jour"}</button>
          </form>
        </div>

        <div className="card card-inner">
          <div className="section-title">Rappels et audit</div>
          <div className="small muted" style={{ marginBottom: 14 }}>Alertes et historique des actions</div>

          <div className="stack-sm">
            {data.reminders.map((r) => (
              <div className="reminder-card" key={r.id}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.message}</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Echeance : {fmtDate(r.dueAt)}{r.invoiceReference ? ` - ${r.invoiceReference}` : ""}</div>
              </div>
            ))}
            {data.reminders.length === 0 && <div className="small muted">Aucun rappel en cours.</div>}

            <hr className="divider" />

            {data.auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="audit-entry">
                <div className="small"><strong>{log.action}</strong> - {log.message}</div>
                <div className="tiny muted">{fmtDate(log.createdAt)} - {log.userName ?? "Systeme"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Invoices table */}
      <section className="card card-inner">
        <div className="space-between" style={{ marginBottom: 16 }}>
          <div>
            <div className="section-title">Factures</div>
            <div className="small muted">Workflow complet : qualifier, valider, payer, reporter, archiver</div>
          </div>
          <div className="badge gray">Connecte : {session.role}</div>
        </div>

        <div className="row" style={{ marginBottom: 14 }}>
          <input className="input" style={{ maxWidth: 280 }} placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <select className="select" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="ALL">Tous les statuts</option>
            {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <div className="small muted">{filteredInvoices.length} facture(s)</div>
        </div>

        <div className="stack-sm" style={{ marginBottom: 14 }}>
          <div className="label">Motif de report par defaut</div>
          <input className="input" value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} style={{ maxWidth: 500 }} />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Fournisseur</th>
                <th>Montant</th>
                <th>Echeance</th>
                <th>Statut</th>
                <th>Categorie</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong style={{ fontSize: 14 }}>{inv.reference}</strong>
                    <div className="tiny muted">{inv.source} - {inv.assignedTo ?? "Non assignee"}</div>
                  </td>
                  <td style={{ fontSize: 14 }}>{inv.supplier.name}</td>
                  <td style={{ fontWeight: 600, fontSize: 14 }}>{fmt(inv.amount)}</td>
                  <td style={{ fontSize: 14 }}>{fmtDate(inv.dueDate)}</td>
                  <td>
                    <span className={`status-pill ${STATUS_CLASS[inv.status] ?? ""}`}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
                    {inv.postponeReason && <div className="tiny muted" style={{ marginTop: 6, maxWidth: 160 }}>{inv.postponeReason}</div>}
                  </td>
                  <td><span className="badge gray">{CATEGORY_LABELS[inv.category] ?? inv.category}</span></td>
                  <td>
                    <div className="row">
                      {inv.status !== "PAYEE" && inv.status !== "ARCHIVEE" && (
                        <button className="button success sm" onClick={() => payInvoice(inv.id)} disabled={loading === inv.id}>Payer</button>
                      )}
                      {inv.status !== "REPORT_DEMANDE" && inv.status !== "PAYEE" && inv.status !== "ARCHIVEE" && (
                        <button className="button warning sm" onClick={() => requestPostpone(inv.id)} disabled={loading === inv.id}>Reporter</button>
                      )}
                      <select className="select" value={inv.status} onChange={(e) => changeStatus(inv.id, e.target.value)} style={{ minWidth: 140, fontSize: 13 }}>
                        {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </div>
                    {inv.paymentDate && <div className="tiny muted" style={{ marginTop: 6 }}>Payee le {fmtDate(inv.paymentDate)}</div>}
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 24 }} className="muted">Aucune facture trouvee.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
