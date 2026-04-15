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

type Tab = "dashboard" | "factures" | "nouvelle" | "budget" | "fournisseurs" | "audit" | "compte";

const VAT_PRESETS = [
  { value: 0, label: "0% (hors taxe)" },
  { value: 2.5, label: "2.5% (reduit CH)" },
  { value: 3.8, label: "3.8% (hebergement CH)" },
  { value: 7.7, label: "7.7% (CH ancien)" },
  { value: 8.1, label: "8.1% (CH standard)" },
  { value: 20, label: "20% (FR standard)" },
];

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
  const [vatRate, setVatRate] = useState("8.1");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  const [category, setCategory] = useState("ACHATS");
  const [source, setSource] = useState("PDF");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [postponeReason, setPostponeReason] = useState("Besoin de decalage de tresorerie");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<any>(null);
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });
  const [pwdMessage, setPwdMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
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
    if (supplierFilter !== "ALL") list = list.filter((i) => i.supplier?.name === supplierFilter);
    if (categoryFilter !== "ALL") list = list.filter((i) => i.category === categoryFilter);
    if (dateFrom) { const d = new Date(dateFrom); list = list.filter((i) => new Date(i.dueDate) >= d); }
    if (dateTo) { const d = new Date(dateTo); d.setHours(23, 59, 59, 999); list = list.filter((i) => new Date(i.dueDate) <= d); }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => [i.reference, i.supplier?.name ?? "", i.category, i.assignedTo ?? "", i.notes ?? ""].join(" ").toLowerCase().includes(q));
    }
    return list;
  }, [data.invoices, statusFilter, supplierFilter, categoryFilter, dateFrom, dateTo, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const pagedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, page]);

  // Reset to page 1 when filters change
  useMemo(() => { if (page > pageCount) setPage(1); }, [pageCount, page]);

  const resetFilters = () => {
    setStatusFilter("ALL"); setSupplierFilter("ALL"); setCategoryFilter("ALL");
    setDateFrom(""); setDateTo(""); setSearchQuery(""); setPage(1);
  };

  const clearForm = () => {
    setReference(""); setAmount(""); setNotes(""); setAttachFile(null);
  };

  const submitInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoading("invoice");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference, supplierName, amount: Number(amount), vatRate: Number(vatRate), dueDate, category, source, notes: notes || null }),
    });
    if (res.ok) {
      const { invoice } = await res.json();
      // Optional attachment
      if (attachFile && invoice?.id) {
        const fd = new FormData(); fd.append("file", attachFile); fd.append("invoiceId", invoice.id);
        await fetch("/api/upload", { method: "POST", body: fd });
      }
      clearForm();
      await refreshData(); showMessage("Facture creee"); setTab("factures");
    } else {
      const err = await res.json();
      showMessage(err.error ?? "Erreur creation");
    }
    setLoading(null);
  };

  const saveInvoiceEdit = async (payload: any) => {
    if (!editingInvoice) return;
    setLoading("edit");
    const res = await fetch(`/api/invoices/${editingInvoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setEditingInvoice(null); await refreshData(); showMessage("Facture modifiee"); }
    else { const err = await res.json(); showMessage(err.error ?? "Erreur"); }
    setLoading(null);
  };

  const confirmDelete = async () => {
    if (!deletingInvoice) return;
    setLoading("delete");
    const res = await fetch(`/api/invoices/${deletingInvoice.id}`, { method: "DELETE" });
    if (res.ok) { setDeletingInvoice(null); await refreshData(); showMessage("Facture supprimee"); }
    else { const err = await res.json(); showMessage(err.error ?? "Erreur"); }
    setLoading(null);
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Supprimer ce document ?")) return;
    await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    await refreshData();
  };

  const attachToInvoice = async (invoiceId: string, file: File) => {
    const fd = new FormData(); fd.append("file", file); fd.append("invoiceId", invoiceId);
    setLoading(`attach-${invoiceId}`);
    await fetch("/api/upload", { method: "POST", body: fd });
    await refreshData(); setLoading(null);
  };

  const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPwdMessage(null);
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdMessage({ type: "error", text: "Les mots de passe ne correspondent pas" }); return;
    }
    if (pwdForm.next.length < 8) {
      setPwdMessage({ type: "error", text: "8 caracteres minimum" }); return;
    }
    setLoading("pwd");
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: pwdForm.current, newPassword: pwdForm.next }),
    });
    if (res.ok) {
      setPwdForm({ current: "", next: "", confirm: "" });
      setPwdMessage({ type: "ok", text: "Mot de passe modifie avec succes" });
    } else {
      const err = await res.json();
      setPwdMessage({ type: "error", text: err.error ?? "Erreur" });
    }
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

      {/* Mobile topbar */}
      <header className="mobile-topbar">
        <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menu">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <div className="brand">Factures Pro</div>
      </header>

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
          <button className={`sidebar-link ${tab === "compte" ? "active" : ""}`} onClick={() => navTo("compte")}>
            <SvgIcon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            Mon compte
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
              <div className="table-responsive" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead><tr><th>Reference</th><th>Fournisseur</th><th>Montant</th><th>Echeance</th><th>Statut</th></tr></thead>
                  <tbody>
                    {data.invoices.slice(0, 5).map((inv) => (
                      <tr key={inv.id}>
                        <td data-label="Reference"><strong>{inv.reference}</strong></td>
                        <td data-label="Fournisseur">{inv.supplier?.name ?? "-"}</td>
                        <td data-label="Montant" style={{ fontWeight: 600 }}>{fmt(inv.amount)}</td>
                        <td data-label="Echeance">{fmtDate(inv.dueDate)}</td>
                        <td data-label="Statut"><span className={`status-pill ${STATUS_CLASS[inv.status] ?? ""}`}>{STATUS_LABELS[inv.status] ?? inv.status}</span></td>
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
              <p className="subtitle">Filtrer, editer, payer, reporter, archiver</p>
            </div>

            <div className="card card-inner">
              <div className="grid grid-3" style={{ gap: 12 }}>
                <div>
                  <div className="label">Recherche</div>
                  <input className="input" placeholder="Reference, fournisseur, notes..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} />
                </div>
                <div>
                  <div className="label">Statut</div>
                  <select className="select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                    <option value="ALL">Tous</option>
                    {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label">Fournisseur</div>
                  <select className="select" value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
                    <option value="ALL">Tous</option>
                    {data.suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label">Categorie</div>
                  <select className="select" value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                    <option value="ALL">Toutes</option>
                    {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label">Echeance du</div>
                  <input type="date" className="input" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
                </div>
                <div>
                  <div className="label">Echeance au</div>
                  <input type="date" className="input" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
                </div>
              </div>
              <div className="row" style={{ marginTop: 12, gap: 12 }}>
                <button className="button secondary sm" onClick={resetFilters}>Reinitialiser</button>
                <div className="small muted">{filteredInvoices.length} facture(s) - page {page}/{pageCount}</div>
              </div>
            </div>

            <div className="card card-inner">
              <div className="label">Motif de report par defaut</div>
              <input className="input" value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} style={{ maxWidth: 420, marginBottom: 16 }} />
              <div className="table-responsive">
                <table className="table">
                  <thead><tr><th>Reference</th><th>Fournisseur</th><th>Montant TTC</th><th>TVA</th><th>Echeance</th><th>Statut</th><th>Categorie</th><th>Docs</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pagedInvoices.map((inv: any) => (
                      <tr key={inv.id}>
                        <td data-label="Reference"><strong style={{ fontSize: 14 }}>{inv.reference}</strong><div className="tiny muted">{inv.source} - {inv.assignedTo ?? "Non assignee"}</div></td>
                        <td data-label="Fournisseur" style={{ fontSize: 14 }}>{inv.supplier?.name}</td>
                        <td data-label="Montant" style={{ fontWeight: 600, fontSize: 14 }}>
                          {fmt(inv.amount)}
                          {inv.amountHt !== null && inv.vatRate > 0 && <div className="tiny muted">HT {fmt(inv.amountHt)}</div>}
                        </td>
                        <td data-label="TVA" style={{ fontSize: 13 }}>{inv.vatRate > 0 ? `${inv.vatRate}%` : "-"}</td>
                        <td data-label="Echeance" style={{ fontSize: 14 }}>{fmtDate(inv.dueDate)}</td>
                        <td data-label="Statut">
                          <span className={`status-pill ${STATUS_CLASS[inv.status] ?? ""}`}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
                          {inv.postponeReason && <div className="tiny muted" style={{ marginTop: 6, maxWidth: 150 }}>{inv.postponeReason}</div>}
                        </td>
                        <td data-label="Categorie"><span className="badge gray">{CATEGORY_LABELS[inv.category] ?? inv.category}</span></td>
                        <td data-label="Docs">
                          {inv.documents?.length > 0 ? (
                            <div className="stack-sm" style={{ gap: 4 }}>
                              {inv.documents.map((d: any) => (
                                <div key={d.id} className="row" style={{ gap: 6 }}>
                                  <a className="tiny" href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" title={d.filename}>📎 {d.filename.length > 18 ? d.filename.slice(0, 16) + ".." : d.filename}</a>
                                  <button className="button secondary sm" style={{ padding: "2px 6px", fontSize: 11 }} onClick={() => deleteDoc(d.id)} aria-label="Supprimer">×</button>
                                </div>
                              ))}
                            </div>
                          ) : <span className="tiny muted">-</span>}
                          <label className="tiny" style={{ display: "block", marginTop: 4, cursor: "pointer", color: "#3b82f6" }}>
                            + Ajouter
                            <input type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) attachToInvoice(inv.id, f); e.target.value = ""; }} />
                          </label>
                        </td>
                        <td className="td-actions">
                          <div className="row">
                            {inv.status !== "PAYEE" && inv.status !== "ARCHIVEE" && <button className="button success sm" onClick={() => payInvoice(inv.id)} disabled={loading === inv.id}>Payer</button>}
                            {!["REPORT_DEMANDE", "PAYEE", "ARCHIVEE"].includes(inv.status) && <button className="button warning sm" onClick={() => requestPostpone(inv.id)} disabled={loading === inv.id}>Reporter</button>}
                            <button className="button secondary sm" onClick={() => setEditingInvoice(inv)}>Editer</button>
                            {(session.role === "ADMIN" || session.role === "ACCOUNTING") && <button className="button danger sm" onClick={() => setDeletingInvoice(inv)}>Supprimer</button>}
                            <select className="select" value={inv.status} onChange={(e) => changeStatus(inv.id, e.target.value)} style={{ minWidth: 130, fontSize: 13 }}>
                              {statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                          </div>
                          {inv.paymentDate && <div className="tiny muted" style={{ marginTop: 6 }}>Payee le {fmtDate(inv.paymentDate)}</div>}
                        </td>
                      </tr>
                    ))}
                    {pagedInvoices.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 24 }} className="muted">Aucune facture.</td></tr>}
                  </tbody>
                </table>
              </div>

              {pageCount > 1 && (
                <div className="row" style={{ justifyContent: "center", marginTop: 16, gap: 6 }}>
                  <button className="button secondary sm" disabled={page === 1} onClick={() => setPage(1)}>«</button>
                  <button className="button secondary sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Precedent</button>
                  <span className="small muted">Page {page} / {pageCount}</span>
                  <button className="button secondary sm" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Suivant</button>
                  <button className="button secondary sm" disabled={page === pageCount} onClick={() => setPage(pageCount)}>»</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Nouvelle facture */}
        {tab === "nouvelle" && (() => {
          const amountNum = Number(amount) || 0;
          const vatNum = Number(vatRate) || 0;
          const ht = vatNum > 0 ? amountNum / (1 + vatNum / 100) : amountNum;
          const tva = amountNum - ht;
          return (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Nouvelle facture</h1>
              <p className="subtitle">Saisie avec TVA, notes et document attache</p>
            </div>
            <div className="card card-inner">
              <div className="section-title">Saisie manuelle</div>
              <form className="stack-sm" onSubmit={submitInvoice} style={{ marginTop: 14 }}>
                <div className="grid grid-2">
                  <div><div className="label">Reference *</div><input className="input" placeholder="FAC-2026-005" value={reference} onChange={(e) => setReference(e.target.value)} required minLength={3} /></div>
                  <div>
                    <div className="label">Fournisseur *</div>
                    <input className="input" list="supplier-list" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nom du fournisseur" required />
                    <datalist id="supplier-list">{data.suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                  </div>
                </div>
                <div className="grid grid-3">
                  <div><div className="label">Montant TTC *</div><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
                  <div>
                    <div className="label">Taux TVA</div>
                    <select className="select" value={vatRate} onChange={(e) => setVatRate(e.target.value)}>
                      {VAT_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div><div className="label">Echeance *</div><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
                </div>
                {amountNum > 0 && vatNum > 0 && (
                  <div className="tiny muted" style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 8 }}>
                    HT: <strong>{fmt(ht)}</strong> · TVA: <strong>{fmt(tva)}</strong> · TTC: <strong>{fmt(amountNum)}</strong>
                  </div>
                )}
                <div className="grid grid-2">
                  <div><div className="label">Categorie</div><select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></div>
                  <div><div className="label">Source</div><select className="select" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>
                <div>
                  <div className="label">Notes (optionnel)</div>
                  <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire, numero de commande, etc." maxLength={500} />
                </div>
                <div>
                  <div className="label">Document attache (optionnel, PDF/image max 20 Mo)</div>
                  <input className="input" type="file" accept="image/*,.pdf" onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)} />
                  {attachFile && <div className="tiny muted" style={{ marginTop: 4 }}>📎 {attachFile.name} ({Math.round(attachFile.size / 1024)} Ko)</div>}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="button" disabled={loading === "invoice"}>{loading === "invoice" ? "Enregistrement..." : "Creer la facture"}</button>
                  <button type="button" className="button secondary" onClick={clearForm}>Vider</button>
                </div>
              </form>
            </div>

            <div className="card card-inner">
              <div className="section-title">Import rapide avec OCR (experimental)</div>
              <p className="small muted" style={{ margin: "8px 0 14px" }}>Fichier analyse automatiquement (simulation). Pour une vraie facture, utilisez le formulaire ci-dessus.</p>
              <input className="input" type="file" accept="image/*,.pdf" onChange={uploadFile} disabled={loading === "upload"} />
              {uploadMessage && <div className="badge blue" style={{ marginTop: 12, whiteSpace: "normal", padding: "8px 12px" }}>{uploadMessage}</div>}
            </div>
          </div>
          );
        })()}

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
              <div className="table-responsive">
                <table className="table">
                  <thead><tr><th>Nom</th><th>Email</th><th>Categorie</th></tr></thead>
                  <tbody>
                    {data.suppliers.map((s) => (
                      <tr key={s.id}>
                        <td data-label="Nom"><strong>{s.name}</strong></td>
                        <td data-label="Email" className="muted">{s.email ?? "-"}</td>
                        <td data-label="Categorie"><span className="badge gray">{s.category ?? "-"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

        {/* TAB: Compte */}
        {tab === "compte" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Mon compte</h1>
              <p className="subtitle">Informations et mot de passe</p>
            </div>
            <div className="grid grid-2">
              <div className="card card-inner">
                <div className="section-title">Informations</div>
                <div className="stack-sm" style={{ marginTop: 12 }}>
                  <div><div className="label">Nom</div><div>{session.fullName}</div></div>
                  <div><div className="label">Email</div><div>{session.email}</div></div>
                  <div><div className="label">Role</div><div><span className="badge blue">{ROLE_LABELS[session.role] ?? session.role}</span></div></div>
                </div>
              </div>
              <div className="card card-inner">
                <div className="section-title">Changer mon mot de passe</div>
                <form className="stack-sm" onSubmit={changePassword} style={{ marginTop: 12 }}>
                  <div><div className="label">Mot de passe actuel</div><input className="input" type="password" value={pwdForm.current} onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))} required autoComplete="current-password" /></div>
                  <div><div className="label">Nouveau mot de passe (min 8 caracteres)</div><input className="input" type="password" value={pwdForm.next} onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))} required minLength={8} autoComplete="new-password" /></div>
                  <div><div className="label">Confirmer</div><input className="input" type="password" value={pwdForm.confirm} onChange={(e) => setPwdForm((f) => ({ ...f, confirm: e.target.value }))} required minLength={8} autoComplete="new-password" /></div>
                  {pwdMessage && <div className={`badge ${pwdMessage.type === "ok" ? "green" : "red"}`} style={{ padding: "8px 12px" }}>{pwdMessage.text}</div>}
                  <button className="button" disabled={loading === "pwd"}>{loading === "pwd" ? "..." : "Enregistrer"}</button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal: Edit invoice */}
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          suppliers={data.suppliers}
          onClose={() => setEditingInvoice(null)}
          onSave={saveInvoiceEdit}
          loading={loading === "edit"}
          fmt={fmt}
        />
      )}

      {/* Modal: Delete confirmation */}
      {deletingInvoice && (
        <div className="modal-overlay" onClick={() => setDeletingInvoice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">Supprimer cette facture ?</div>
            <p className="small" style={{ marginTop: 12 }}>
              La facture <strong>{deletingInvoice.reference}</strong> ({deletingInvoice.supplier?.name}, {fmt(deletingInvoice.amount)}) sera definitivement supprimee. Cette action est irreversible.
            </p>
            <div className="row" style={{ marginTop: 20, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setDeletingInvoice(null)}>Annuler</button>
              <button className="button danger" onClick={confirmDelete} disabled={loading === "delete"}>{loading === "delete" ? "Suppression..." : "Supprimer definitivement"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditInvoiceModal({ invoice, suppliers, onClose, onSave, loading, fmt }: {
  invoice: any; suppliers: any[]; onClose: () => void; onSave: (p: any) => void; loading: boolean; fmt: (v: number) => string;
}) {
  const [form, setForm] = useState({
    reference: invoice.reference,
    supplierName: invoice.supplier?.name ?? "",
    amount: String(invoice.amount),
    vatRate: String(invoice.vatRate ?? 0),
    dueDate: invoice.dueDate.slice(0, 10),
    category: invoice.category,
    source: invoice.source,
    notes: invoice.notes ?? "",
  });

  const amountNum = Number(form.amount) || 0;
  const vatNum = Number(form.vatRate) || 0;
  const ht = vatNum > 0 ? amountNum / (1 + vatNum / 100) : amountNum;
  const tva = amountNum - ht;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      reference: form.reference,
      supplierName: form.supplierName,
      amount: Number(form.amount),
      vatRate: Number(form.vatRate),
      dueDate: form.dueDate,
      category: form.category,
      source: form.source,
      notes: form.notes || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="space-between">
          <div className="section-title">Modifier la facture</div>
          <button className="button secondary sm" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <form className="stack-sm" onSubmit={submit} style={{ marginTop: 16 }}>
          <div className="grid grid-2">
            <div><div className="label">Reference</div><input className="input" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} required /></div>
            <div>
              <div className="label">Fournisseur</div>
              <input className="input" list="edit-supplier-list" value={form.supplierName} onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))} required />
              <datalist id="edit-supplier-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
            </div>
          </div>
          <div className="grid grid-3">
            <div><div className="label">Montant TTC</div><input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required /></div>
            <div>
              <div className="label">Taux TVA</div>
              <select className="select" value={form.vatRate} onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}>
                {VAT_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div><div className="label">Echeance</div><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} required /></div>
          </div>
          {amountNum > 0 && vatNum > 0 && (
            <div className="tiny muted" style={{ background: "#f8fafc", padding: "8px 12px", borderRadius: 8 }}>
              HT: <strong>{fmt(ht)}</strong> · TVA: <strong>{fmt(tva)}</strong> · TTC: <strong>{fmt(amountNum)}</strong>
            </div>
          )}
          <div className="grid grid-2">
            <div><div className="label">Categorie</div><select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></div>
            <div><div className="label">Source</div><select className="select" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div>
            <div className="label">Notes</div>
            <textarea className="textarea" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={500} />
          </div>
          <div className="row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
            <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
            <button className="button" disabled={loading}>{loading ? "Enregistrement..." : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
