"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionPayload } from "@/lib/auth";
import type { DashboardData } from "@/lib/dashboard";

const CATEGORY_LABELS: Record<string, string> = {
  ASSURANCE: "Assurance", ACHATS: "Achats", ESSENCE: "Essence", LOYER: "Loyer",
  TELECOM: "Telecom", LOGICIELS: "Logiciels", FOURNITURES: "Fournitures",
  TRANSPORT: "Transport", AUTRES: "Autres",
};
const STATUS_LABELS: Record<string, string> = {
  A_QUALIFIER: "A qualifier", A_VALIDER: "A valider", A_PAYER: "A payer",
  REPORT_DEMANDE: "Report demande", PAYEE: "Payee", ARCHIVEE: "Archivee",
};
const STATUS_CLASS: Record<string, string> = {
  A_QUALIFIER: "qualifier", A_VALIDER: "valider", A_PAYER: "payer",
  REPORT_DEMANDE: "report", PAYEE: "payee", ARCHIVEE: "archivee",
};
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur", ACCOUNTING: "Comptabilite", MANAGER: "Manager",
};

const categories = Object.keys(CATEGORY_LABELS);
const statuses = Object.keys(STATUS_LABELS);
const sources = ["PDF", "SCAN", "EMAIL", "MANUEL"];

const CURRENCIES = [
  { code: "CHF", label: "CHF - Franc suisse", locale: "fr-CH" },
  { code: "EUR", label: "EUR - Euro", locale: "fr-FR" },
  { code: "USD", label: "USD - Dollar US", locale: "en-US" },
  { code: "GBP", label: "GBP - Livre sterling", locale: "en-GB" },
];

type Tab = "dashboard" | "factures" | "nouvelle" | "budget" | "fournisseurs" | "audit";

function getSavedCurrency(): string {
  if (typeof window === "undefined") return "CHF";
  return localStorage.getItem("factures_currency") ?? "CHF";
}

function makeFmt(currencyCode: string) {
  const curr = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  return (v: number) => new Intl.NumberFormat(curr.locale, { style: "currency", currency: curr.code }).format(v);
}
function fmtDate(v: string | null) {
  if (!v) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(v));
}

function SvgIcon({ d }: { d: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

export default function DashboardClient({ initialData, session }: { initialData: DashboardData; session: SessionPayload }) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currency, setCurrency] = useState(getSavedCurrency);
  const fmt = useMemo(() => makeFmt(currency), [currency]);

  const handleCurrencyChange = (code: string) => {
    setCurrency(code);
    localStorage.setItem("factures_currency", code);
  };
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

  const showMessage = (text: string) => { setMessage(text); setTimeout(() => setMessage(null), 3000); };

  const filteredInvoices = useMemo(() => {
    let list = data.invoices;
    if (statusFilter !== "ALL") list = list.filter((i) => i.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => [i.reference, i.supplier.name, i.category, i.assignedTo ?? ""].join(" ").toLowerCase().includes(q));
    }
    return list;
  }, [data.invoices, statusFilter, searchQuery]);

  const submitInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoading("invoice");
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference, supplierName, amount: Number(amount), dueDate, category, source }) });
    if (res.ok) { setReference(""); setAmount(""); await refreshData(); showMessage("Facture creee"); setTab("factures"); }
    setLoading(null);
  };

  const updateBudget = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoading("budget");
    await fetch("/api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ monthKey: budgetForm.monthKey, monthLabel: budgetForm.monthLabel, purchaseBudget: Number(budgetForm.purchaseBudget), expenseBudget: Number(budgetForm.expenseBudget), reserveAvailable: Number(budgetForm.reserveAvailable) }) });
    await refreshData(); showMessage("Budget mis a jour"); setLoading(null);
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append("file", file); setLoading("upload");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const result = await res.json();
    if (res.ok) { setUploadMessage(`OCR : ${result.analysis.supplierName} - ${fmt(result.analysis.amount)}`); await refreshData(); }
    else setUploadMessage(result.error ?? "Erreur");
    setLoading(null);
  };

  const payInvoice = async (id: string) => {
    setLoading(id);
    await fetch(`/api/invoices/${id}/pay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentDate: new Date().toISOString().slice(0, 10) }) });
    await refreshData(); showMessage("Facture payee"); setLoading(null);
  };

  const requestPostpone = async (id: string) => {
    setLoading(id);
    await fetch(`/api/invoices/${id}/postpone`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: postponeReason }) });
    await refreshData(); showMessage("Report enregistre"); setLoading(null);
  };

  const changeStatus = async (id: string, next: string) => {
    setLoading(id);
    await fetch(`/api/invoices/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    await refreshData(); setLoading(null);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  };

  const ratios = useMemo(() => {
    const p = data.stats.totalPurchases / Math.max(data.budget?.purchaseBudget ?? 1, 1) * 100;
    const e = data.stats.totalExpenses / Math.max(data.budget?.expenseBudget ?? 1, 1) * 100;
    const r = (data.budget?.reserveAvailable ?? 0) / Math.max(data.budget?.expenseBudget ?? 1, 1) * 100;
    return { purchase: Math.min(p, 100), expense: Math.min(e, 100), reserve: Math.min(r, 100) };
  }, [data]);

  const navTo = (t: Tab) => { setTab(t); setSidebarOpen(false); };

  const overdueCount = data.stats.overdueCount;

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <div className={`sidebar-overlay ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* Mobile menu button */}
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>Menu</button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">Factures Pro</div>
          <div className="sidebar-subtitle">Gestion des factures V6</div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section">Principal</div>
          <button className={`sidebar-link ${tab === "dashboard" ? "active" : ""}`} onClick={() => navTo("dashboard")}>
            <SvgIcon d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            Tableau de bord
          </button>
          <button className={`sidebar-link ${tab === "factures" ? "active" : ""}`} onClick={() => navTo("factures")}>
            <SvgIcon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            Factures
            {overdueCount > 0 && <span className="sidebar-badge">{overdueCount}</span>}
          </button>
          <button className={`sidebar-link ${tab === "nouvelle" ? "active" : ""}`} onClick={() => navTo("nouvelle")}>
            <SvgIcon d="M12 4v16m8-8H4" />
            Nouvelle facture
          </button>

          <div className="sidebar-section">Gestion</div>
          <button className={`sidebar-link ${tab === "budget" ? "active" : ""}`} onClick={() => navTo("budget")}>
            <SvgIcon d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            Budget et reserve
          </button>
          <button className={`sidebar-link ${tab === "fournisseurs" ? "active" : ""}`} onClick={() => navTo("fournisseurs")}>
            <SvgIcon d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            Fournisseurs
          </button>
          <button className={`sidebar-link ${tab === "audit" ? "active" : ""}`} onClick={() => navTo("audit")}>
            <SvgIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            Audit et rappels
          </button>

          <div style={{ flex: 1 }} />

          <a className="sidebar-link" href="/api/invoices/export">
            <SvgIcon d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            Exporter CSV
          </a>
        </nav>

        <div style={{ padding: "0 10px 8px" }}>
          <div className="sidebar-section">Devise</div>
          <select
            className="select"
            value={currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155", fontSize: 13 }}
          >
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{session.fullName.charAt(0)}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{session.fullName}</div>
              <div className="sidebar-user-role">{ROLE_LABELS[session.role] ?? session.role}</div>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout}>Se deconnecter</button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {message && <div className="badge green" style={{ padding: "10px 16px", fontSize: 14, marginBottom: 16 }}>{message}</div>}

        {/* TAB: Dashboard */}
        {tab === "dashboard" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Tableau de bord</h1>
              <p className="subtitle">Vue d'ensemble de l'activite factures et budget</p>
            </div>
            <section className="grid grid-4">
              <div className="card stat-card accent-blue"><div className="stat-label">A payer</div><div className="stat-value">{fmt(data.stats.totalToPay)}</div><div className="stat-hint">Echeances en cours</div></div>
              <div className="card stat-card accent-green"><div className="stat-label">Payees</div><div className="stat-value">{fmt(data.stats.totalPaid)}</div><div className="stat-hint">Reglements effectues</div></div>
              <div className="card stat-card accent-red"><div className="stat-label">En retard</div><div className="stat-value">{data.stats.overdueCount}</div><div className="stat-hint">A traiter en priorite</div></div>
              <div className="card stat-card accent-purple"><div className="stat-label">Reserve</div><div className="stat-value">{fmt(data.budget?.reserveAvailable ?? 0)}</div><div className="stat-hint">Marge de securite</div></div>
            </section>
            <section className="grid grid-2">
              <div className="card card-inner">
                <div className="section-title">Budget</div>
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  <div><div className="space-between tiny"><span className="muted">Achats</span><strong>{fmt(data.stats.totalPurchases)} / {fmt(data.budget?.purchaseBudget ?? 0)}</strong></div><div className="progress"><span className="bar-blue" style={{ width: `${ratios.purchase}%` }} /></div></div>
                  <div><div className="space-between tiny"><span className="muted">Depenses</span><strong>{fmt(data.stats.totalExpenses)} / {fmt(data.budget?.expenseBudget ?? 0)}</strong></div><div className="progress"><span className="bar-default" style={{ width: `${ratios.expense}%` }} /></div></div>
                  <div><div className="space-between tiny"><span className="muted">Reserve</span><strong>{fmt(data.budget?.reserveAvailable ?? 0)}</strong></div><div className="progress"><span className="bar-green" style={{ width: `${ratios.reserve}%` }} /></div></div>
                </div>
              </div>
              <div className="card card-inner">
                <div className="section-title">Rappels</div>
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  {data.reminders.length === 0 && <div className="small muted">Aucun rappel en cours.</div>}
                  {data.reminders.map((r) => (
                    <div className="reminder-card" key={r.id}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.message}</div>
                      <div className="tiny muted" style={{ marginTop: 4 }}>{fmtDate(r.dueAt)}{r.invoiceReference ? ` - ${r.invoiceReference}` : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="card card-inner">
              <div className="space-between">
                <div className="section-title">Dernieres factures</div>
                <button className="button secondary sm" onClick={() => setTab("factures")}>Voir tout</button>
              </div>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table className="table">
                  <thead><tr><th>Reference</th><th>Fournisseur</th><th>Montant</th><th>Echeance</th><th>Statut</th></tr></thead>
                  <tbody>
                    {data.invoices.slice(0, 5).map((inv) => (
                      <tr key={inv.id}>
                        <td><strong>{inv.reference}</strong></td>
                        <td>{inv.supplier.name}</td>
                        <td style={{ fontWeight: 600 }}>{fmt(inv.amount)}</td>
                        <td>{fmtDate(inv.dueDate)}</td>
                        <td><span className={`status-pill ${STATUS_CLASS[inv.status] ?? ""}`}>{STATUS_LABELS[inv.status] ?? inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB: Factures */}
        {tab === "factures" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Factures</h1>
              <p className="subtitle">Workflow : qualifier, valider, payer, reporter, archiver</p>
            </div>
            <div className="row" style={{ gap: 12 }}>
              <input className="input" style={{ maxWidth: 260 }} placeholder="Rechercher..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <select className="select" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">Tous les statuts</option>
                {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <div className="small muted">{filteredInvoices.length} facture(s)</div>
            </div>
            <div className="card card-inner">
              <div className="label">Motif de report par defaut</div>
              <input className="input" value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} style={{ maxWidth: 420, marginBottom: 16 }} />
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead><tr><th>Reference</th><th>Fournisseur</th><th>Montant</th><th>Echeance</th><th>Statut</th><th>Categorie</th><th>Actions</th></tr></thead>
                  <tbody>
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td><strong style={{ fontSize: 14 }}>{inv.reference}</strong><div className="tiny muted">{inv.source} - {inv.assignedTo ?? "Non assignee"}</div></td>
                        <td style={{ fontSize: 14 }}>{inv.supplier.name}</td>
                        <td style={{ fontWeight: 600, fontSize: 14 }}>{fmt(inv.amount)}</td>
                        <td style={{ fontSize: 14 }}>{fmtDate(inv.dueDate)}</td>
                        <td>
                          <span className={`status-pill ${STATUS_CLASS[inv.status] ?? ""}`}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
                          {inv.postponeReason && <div className="tiny muted" style={{ marginTop: 6, maxWidth: 150 }}>{inv.postponeReason}</div>}
                        </td>
                        <td><span className="badge gray">{CATEGORY_LABELS[inv.category] ?? inv.category}</span></td>
                        <td>
                          <div className="row">
                            {inv.status !== "PAYEE" && inv.status !== "ARCHIVEE" && <button className="button success sm" onClick={() => payInvoice(inv.id)} disabled={loading === inv.id}>Payer</button>}
                            {!["REPORT_DEMANDE", "PAYEE", "ARCHIVEE"].includes(inv.status) && <button className="button warning sm" onClick={() => requestPostpone(inv.id)} disabled={loading === inv.id}>Reporter</button>}
                            <select className="select" value={inv.status} onChange={(e) => changeStatus(inv.id, e.target.value)} style={{ minWidth: 130, fontSize: 13 }}>
                              {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                          </div>
                          {inv.paymentDate && <div className="tiny muted" style={{ marginTop: 6 }}>Payee le {fmtDate(inv.paymentDate)}</div>}
                        </td>
                      </tr>
                    ))}
                    {filteredInvoices.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 24 }} className="muted">Aucune facture trouvee.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Nouvelle facture */}
        {tab === "nouvelle" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Nouvelle facture</h1>
              <p className="subtitle">Saisie manuelle ou import avec OCR simule</p>
            </div>
            <div className="grid grid-2">
              <div className="card card-inner">
                <div className="section-title">Saisie manuelle</div>
                <form className="stack-sm" onSubmit={submitInvoice} style={{ marginTop: 14 }}>
                  <div><div className="label">Reference</div><input className="input" placeholder="FAC-2026-005" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
                  <div><div className="label">Fournisseur</div><select className="select" value={supplierName} onChange={(e) => setSupplierName(e.target.value)}>{data.suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}</select></div>
                  <div className="grid grid-2">
                    <div><div className="label">Montant</div><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
                    <div><div className="label">Echeance</div><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-2">
                    <div><div className="label">Categorie</div><select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></div>
                    <div><div className="label">Source</div><select className="select" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                  </div>
                  <button className="button" style={{ marginTop: 8 }} disabled={loading === "invoice"}>{loading === "invoice" ? "Enregistrement..." : "Creer la facture"}</button>
                </form>
              </div>
              <div className="card card-inner">
                <div className="section-title">Import scan / PDF</div>
                <p className="small muted" style={{ margin: "8px 0 14px" }}>Le fichier est analyse par OCR simule pour pre-remplir les champs.</p>
                <input className="input" type="file" accept="image/*,.pdf" onChange={uploadFile} disabled={loading === "upload"} />
                {uploadMessage && <div className="badge blue" style={{ marginTop: 12, whiteSpace: "normal", padding: "8px 12px" }}>{uploadMessage}</div>}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Budget */}
        {tab === "budget" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Budget et reserve</h1>
              <p className="subtitle">Pilotage achats, depenses et marge de tresorerie</p>
            </div>
            <div className="grid grid-3">
              <div className="card stat-card accent-blue"><div className="stat-label">Achats</div><div className="stat-value">{fmt(data.stats.totalPurchases)}</div><div className="stat-hint">sur {fmt(data.budget?.purchaseBudget ?? 0)}</div></div>
              <div className="card stat-card accent-purple"><div className="stat-label">Depenses</div><div className="stat-value">{fmt(data.stats.totalExpenses)}</div><div className="stat-hint">sur {fmt(data.budget?.expenseBudget ?? 0)}</div></div>
              <div className="card stat-card accent-green"><div className="stat-label">Reserve</div><div className="stat-value">{fmt(data.budget?.reserveAvailable ?? 0)}</div><div className="stat-hint">Marge de securite</div></div>
            </div>
            <div className="card card-inner">
              <div className="section-title">Barres de progression</div>
              <div className="stack-sm" style={{ marginTop: 14 }}>
                <div><div className="space-between small"><span>Achats</span><strong>{fmt(data.stats.totalPurchases)} / {fmt(data.budget?.purchaseBudget ?? 0)}</strong></div><div className="progress"><span className="bar-blue" style={{ width: `${ratios.purchase}%` }} /></div></div>
                <div><div className="space-between small"><span>Depenses</span><strong>{fmt(data.stats.totalExpenses)} / {fmt(data.budget?.expenseBudget ?? 0)}</strong></div><div className="progress"><span className="bar-default" style={{ width: `${ratios.expense}%` }} /></div></div>
                <div><div className="space-between small"><span>Reserve</span><strong>{fmt(data.budget?.reserveAvailable ?? 0)}</strong></div><div className="progress"><span className="bar-green" style={{ width: `${ratios.reserve}%` }} /></div></div>
              </div>
            </div>
            <div className="card card-inner">
              <div className="section-title">Modifier le budget</div>
              <form className="stack-sm" onSubmit={updateBudget} style={{ marginTop: 14 }}>
                <div className="grid grid-2">
                  <div><div className="label">Cle mois</div><input className="input" value={budgetForm.monthKey} onChange={(e) => setBudgetForm((c) => ({ ...c, monthKey: e.target.value }))} /></div>
                  <div><div className="label">Libelle</div><input className="input" value={budgetForm.monthLabel} onChange={(e) => setBudgetForm((c) => ({ ...c, monthLabel: e.target.value }))} /></div>
                </div>
                <div className="grid grid-3">
                  <div><div className="label">Budget achats</div><input className="input" type="number" step="0.01" value={budgetForm.purchaseBudget} onChange={(e) => setBudgetForm((c) => ({ ...c, purchaseBudget: e.target.value }))} /></div>
                  <div><div className="label">Budget depenses</div><input className="input" type="number" step="0.01" value={budgetForm.expenseBudget} onChange={(e) => setBudgetForm((c) => ({ ...c, expenseBudget: e.target.value }))} /></div>
                  <div><div className="label">Reserve</div><input className="input" type="number" step="0.01" value={budgetForm.reserveAvailable} onChange={(e) => setBudgetForm((c) => ({ ...c, reserveAvailable: e.target.value }))} /></div>
                </div>
                <button className="button" disabled={loading === "budget"}>{loading === "budget" ? "Sauvegarde..." : "Mettre a jour"}</button>
              </form>
            </div>
          </div>
        )}

        {/* TAB: Fournisseurs */}
        {tab === "fournisseurs" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Fournisseurs</h1>
              <p className="subtitle">Liste des fournisseurs enregistres</p>
            </div>
            <div className="card card-inner">
              <table className="table">
                <thead><tr><th>Nom</th><th>Email</th><th>Categorie</th></tr></thead>
                <tbody>
                  {data.suppliers.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td className="muted">{s.email ?? "-"}</td>
                      <td><span className="badge gray">{s.category ?? "-"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: Audit */}
        {tab === "audit" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Audit et rappels</h1>
              <p className="subtitle">Historique des actions et alertes a venir</p>
            </div>
            <div className="grid grid-2">
              <div className="card card-inner">
                <div className="section-title">Rappels en cours</div>
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  {data.reminders.length === 0 && <div className="small muted">Aucun rappel.</div>}
                  {data.reminders.map((r) => (
                    <div className="reminder-card" key={r.id}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.message}</div>
                      <div className="tiny muted" style={{ marginTop: 4 }}>{fmtDate(r.dueAt)}{r.invoiceReference ? ` - ${r.invoiceReference}` : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card card-inner">
                <div className="section-title">Journal d'audit</div>
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  {data.auditLogs.map((log) => (
                    <div key={log.id} className="audit-entry">
                      <div className="small"><strong>{log.action}</strong> - {log.message}</div>
                      <div className="tiny muted">{fmtDate(log.createdAt)} - {log.userName ?? "Systeme"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
