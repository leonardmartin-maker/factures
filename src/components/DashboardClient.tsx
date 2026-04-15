"use client";

import { useEffect, useMemo, useState } from "react";
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

type Tab = "dashboard" | "factures" | "nouvelle" | "budget" | "fournisseurs" | "equipe" | "rapports" | "audit" | "compte" | "parametres";

const VAT_PRESETS = [
  { value: 0, label: "0% (hors taxe)" },
  { value: 2.5, label: "2.5% (reduit CH)" },
  { value: 3.8, label: "3.8% (hebergement CH)" },
  { value: 7.7, label: "7.7% (CH ancien)" },
  { value: 8.1, label: "8.1% (CH standard)" },
  { value: 20, label: "20% (FR standard)" },
];

const PAYMENT_METHODS = [
  { value: "", label: "-" },
  { value: "VIREMENT", label: "Virement" },
  { value: "CARTE", label: "Carte bancaire" },
  { value: "PRELEVEMENT", label: "Prelevement" },
  { value: "ESPECES", label: "Especes" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "AUTRE", label: "Autre" },
];
const PAYMENT_METHOD_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((p) => [p.value, p.label]));

function fmtCurrency(v: number, code: string) {
  const curr = CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
  return new Intl.NumberFormat(curr.locale, { style: "currency", currency: curr.code }).format(v);
}

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
  const [supplierReference, setSupplierReference] = useState("");
  const [amount, setAmount] = useState("");
  const [vatRate, setVatRate] = useState("8.1");
  const [invoiceCurrency, setInvoiceCurrency] = useState("CHF");
  const [paymentMethod, setPaymentMethod] = useState("VIREMENT");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  const [category, setCategory] = useState("ACHATS");
  const [source, setSource] = useState("PDF");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [autoRef, setAutoRef] = useState(true);
  const [nextRefPreview, setNextRefPreview] = useState<string | null>(null);

  // Suppliers CRUD state
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<any>(null);

  // Users CRUD state
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [resettingUser, setResettingUser] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);

  // Payments
  const [payingInvoice, setPayingInvoice] = useState<any>(null);

  // OCR
  const [ocrResult, setOcrResult] = useState<any>(null);
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
    setReference(""); setSupplierReference(""); setAmount(""); setNotes(""); setAttachFile(null);
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  };

  // Preview du prochain numero auto
  const fetchNextRef = async () => {
    try {
      const res = await fetch("/api/invoices/next-number", { cache: "no-store" });
      if (res.ok) {
        const { preview } = await res.json();
        setNextRefPreview(preview);
      }
    } catch {}
  };
  useEffect(() => {
    if (tab === "nouvelle" && autoRef) fetchNextRef();
  }, [tab, autoRef]);

  const submitInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoading("invoice");
    const payload: any = {
      supplierName,
      supplierReference: supplierReference || null,
      amount: Number(amount),
      vatRate: Number(vatRate),
      currency: invoiceCurrency,
      issueDate: issueDate || null,
      dueDate,
      paymentMethod: paymentMethod || null,
      category, source,
      notes: notes || null,
    };
    if (!autoRef && reference.trim()) payload.reference = reference.trim();
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      const { invoice } = await res.json();
      if (attachFile && invoice?.id) {
        const fd = new FormData(); fd.append("file", attachFile); fd.append("invoiceId", invoice.id);
        await fetch("/api/upload", { method: "POST", body: fd });
      }
      clearForm();
      await refreshData(); showMessage(`Facture ${invoice.reference} creee`); setTab("factures");
    } else {
      const err = await res.json();
      showMessage(err.error ?? "Erreur creation");
    }
    setLoading(null);
  };

  // Suppliers CRUD
  const saveSupplier = async (data: any, id?: string) => {
    setLoading("supplier");
    const url = id ? `/api/suppliers/${id}` : "/api/suppliers";
    const res = await fetch(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) {
      setEditingSupplier(null); setCreatingSupplier(false);
      await refreshData(); showMessage(id ? "Fournisseur modifie" : "Fournisseur cree");
    } else {
      const err = await res.json(); showMessage(err.error ?? "Erreur");
    }
    setLoading(null);
  };

  const confirmDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setLoading("delete-supplier");
    const res = await fetch(`/api/suppliers/${deletingSupplier.id}`, { method: "DELETE" });
    if (res.ok) { setDeletingSupplier(null); await refreshData(); showMessage("Fournisseur supprime"); }
    else { const err = await res.json(); showMessage(err.error ?? "Erreur"); }
    setLoading(null);
  };

  // Users CRUD
  const saveUser = async (data: any, id?: string) => {
    setLoading("user");
    const url = id ? `/api/users/${id}` : "/api/users";
    const res = await fetch(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (res.ok) {
      setEditingUser(null); setCreatingUser(false);
      await refreshData(); showMessage(id ? "Utilisateur modifie" : "Utilisateur cree");
    } else {
      const err = await res.json(); showMessage(err.error ?? "Erreur");
    }
    setLoading(null);
  };

  const confirmDeleteUser = async () => {
    if (!deletingUser) return;
    setLoading("delete-user");
    const res = await fetch(`/api/users/${deletingUser.id}`, { method: "DELETE" });
    if (res.ok) { setDeletingUser(null); await refreshData(); showMessage("Utilisateur supprime"); }
    else { const err = await res.json(); showMessage(err.error ?? "Erreur"); }
    setLoading(null);
  };

  // Paiement partiel
  const addPayment = async (amount: number, paidAt: string, method: string, note: string) => {
    if (!payingInvoice) return;
    setLoading("pay-partial");
    const res = await fetch(`/api/invoices/${payingInvoice.id}/payments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, paidAt, method: method || null, note: note || null }),
    });
    if (res.ok) { setPayingInvoice(null); await refreshData(); showMessage("Paiement enregistre"); }
    else { const err = await res.json(); showMessage(err.error ?? "Erreur"); }
    setLoading(null);
  };

  // OCR sur document
  const runOcr = async (documentId: string) => {
    setLoading(`ocr-${documentId}`);
    setOcrResult(null);
    const res = await fetch(`/api/ocr?documentId=${documentId}`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      setOcrResult(d);
    } else {
      const err = await res.json();
      showMessage(err.error ?? "Erreur OCR");
    }
    setLoading(null);
  };

  const resetUserPwd = async (newPassword: string) => {
    if (!resettingUser) return;
    setLoading("reset-pwd");
    const res = await fetch(`/api/users/${resettingUser.id}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword }) });
    if (res.ok) { setResettingUser(null); showMessage("Mot de passe reinitialise"); }
    else { const err = await res.json(); showMessage(err.error ?? "Erreur"); }
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
          {session.role === "ADMIN" && (
            <button className={`sidebar-link ${tab === "equipe" ? "active" : ""}`} onClick={() => navTo("equipe")}>
              <SvgIcon d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              Equipe
            </button>
          )}
          <button className={`sidebar-link ${tab === "rapports" ? "active" : ""}`} onClick={() => navTo("rapports")}>
            <SvgIcon d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            Rapports TVA
          </button>
          <button className={`sidebar-link ${tab === "audit" ? "active" : ""}`} onClick={() => navTo("audit")}>
            <SvgIcon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            Audit et rappels
          </button>
          {session.role === "ADMIN" && (
            <button className={`sidebar-link ${tab === "parametres" ? "active" : ""}`} onClick={() => navTo("parametres")}>
              <SvgIcon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              Parametres
            </button>
          )}
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
              <h1 className="title">Tableau de bord{data.settings?.companyName ? ` - ${data.settings.companyName}` : ""}</h1>
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

            <section className="grid grid-2">
              <MonthlyChart invoices={data.invoices} fmt={fmt} />
              <CategoryChart invoices={data.invoices} fmt={fmt} />
            </section>

            <section className="grid grid-2">
              <SuppliersChart invoices={data.invoices} fmt={fmt} />
              <StatusChart invoices={data.invoices} />
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
                    {data.invoices.slice(0, 5).map((inv: any) => (
                      <tr key={inv.id}>
                        <td data-label="Reference"><strong>{inv.reference}</strong></td>
                        <td data-label="Fournisseur">{inv.supplier?.name ?? "-"}</td>
                        <td data-label="Montant" style={{ fontWeight: 600 }}>{fmtCurrency(inv.amount, inv.currency)}</td>
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
                        <td data-label="Reference">
                          <strong style={{ fontSize: 14 }}>{inv.reference}</strong>
                          {inv.supplierReference && <div className="tiny muted">Ref fourn.: {inv.supplierReference}</div>}
                          <div className="tiny muted">{inv.source} - {inv.assignedTo ?? "Non assignee"}</div>
                        </td>
                        <td data-label="Fournisseur" style={{ fontSize: 14 }}>
                          {inv.supplier?.name}
                          {inv.paymentMethod && <div className="tiny muted">{PAYMENT_METHOD_LABELS[inv.paymentMethod] ?? inv.paymentMethod}</div>}
                        </td>
                        <td data-label="Montant" style={{ fontWeight: 600, fontSize: 14 }}>
                          {fmtCurrency(inv.amount, inv.currency)}
                          {inv.amountHt !== null && inv.vatRate > 0 && <div className="tiny muted">HT {fmtCurrency(inv.amountHt, inv.currency)}</div>}
                        </td>
                        <td data-label="TVA" style={{ fontSize: 13 }}>{inv.vatRate > 0 ? `${inv.vatRate}%` : "-"}</td>
                        <td data-label="Echeance" style={{ fontSize: 14 }}>
                          {fmtDate(inv.dueDate)}
                          {inv.issueDate && <div className="tiny muted">Emise {fmtDate(inv.issueDate)}</div>}
                        </td>
                        <td data-label="Statut">
                          <span className={`status-pill ${STATUS_CLASS[inv.status] ?? ""}`}>{STATUS_LABELS[inv.status] ?? inv.status}</span>
                          {inv.postponeReason && <div className="tiny muted" style={{ marginTop: 6, maxWidth: 150 }}>{inv.postponeReason}</div>}
                        </td>
                        <td data-label="Categorie"><span className="badge gray">{CATEGORY_LABELS[inv.category] ?? inv.category}</span></td>
                        <td data-label="Docs">
                          {inv.documents?.length > 0 ? (
                            <div className="stack-sm" style={{ gap: 4 }}>
                              {inv.documents.map((d: any) => (
                                <div key={d.id} className="row" style={{ gap: 4 }}>
                                  <a className="tiny" href={`/api/documents/${d.id}`} target="_blank" rel="noopener noreferrer" title={d.filename}>📎 {d.filename.length > 14 ? d.filename.slice(0, 12) + ".." : d.filename}</a>
                                  <button className="button secondary sm" style={{ padding: "2px 6px", fontSize: 11 }} onClick={() => runOcr(d.id)} disabled={loading === `ocr-${d.id}`} aria-label="OCR" title="OCR">{loading === `ocr-${d.id}` ? "..." : "🔍"}</button>
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
                            {inv.status !== "PAYEE" && inv.status !== "ARCHIVEE" && <button className="button secondary sm" onClick={() => setPayingInvoice(inv)}>+ Paiement partiel</button>}
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
          const formFmt = (v: number) => fmtCurrency(v, invoiceCurrency);
          return (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Nouvelle facture</h1>
              <p className="subtitle">Tous les champs pour une comptabilite propre</p>
            </div>
            <div className="card card-inner">
              <form className="stack-sm" onSubmit={submitInvoice}>
                <div className="section-title">Reference</div>
                <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
                  <label className="tiny" style={{ display: "flex", gap: 6, alignItems: "center", minHeight: 44 }}>
                    <input type="checkbox" checked={autoRef} onChange={(e) => { setAutoRef(e.target.checked); if (e.target.checked) fetchNextRef(); }} />
                    Numerotation automatique
                  </label>
                  {autoRef ? (
                    <div style={{ flex: 1 }}>
                      <div className="label">Numero qui sera genere</div>
                      <input className="input" readOnly value={nextRefPreview ?? "(sera genere)"} style={{ background: "#f8fafc" }} onFocus={fetchNextRef} />
                    </div>
                  ) : (
                    <div style={{ flex: 1 }}>
                      <div className="label">Reference *</div>
                      <input className="input" placeholder="FAC-2026-005" value={reference} onChange={(e) => setReference(e.target.value)} required minLength={3} />
                    </div>
                  )}
                </div>

                <hr className="divider" style={{ margin: "12px 0" }} />
                <div className="section-title">Fournisseur</div>
                <div className="grid grid-2">
                  <div>
                    <div className="label">Nom *</div>
                    <input className="input" list="supplier-list" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nom du fournisseur" required />
                    <datalist id="supplier-list">{data.suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
                  </div>
                  <div>
                    <div className="label">N° de facture fournisseur</div>
                    <input className="input" value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} placeholder="Ex: INV-2026-334" />
                  </div>
                </div>

                <hr className="divider" style={{ margin: "12px 0" }} />
                <div className="section-title">Montant et TVA</div>
                <div className="grid grid-3">
                  <div><div className="label">Montant TTC *</div><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
                  <div>
                    <div className="label">Devise</div>
                    <select className="select" value={invoiceCurrency} onChange={(e) => setInvoiceCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="label">Taux TVA</div>
                    <select className="select" value={vatRate} onChange={(e) => setVatRate(e.target.value)}>
                      {VAT_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>
                {amountNum > 0 && vatNum > 0 && (
                  <div className="tiny" style={{ background: "#f0f9ff", padding: "10px 14px", borderRadius: 8, border: "1px solid #bae6fd" }}>
                    HT : <strong>{formFmt(ht)}</strong> · TVA ({vatNum}%) : <strong>{formFmt(tva)}</strong> · TTC : <strong>{formFmt(amountNum)}</strong>
                  </div>
                )}

                <hr className="divider" style={{ margin: "12px 0" }} />
                <div className="section-title">Dates et paiement</div>
                <div className="grid grid-3">
                  <div><div className="label">Date d'emission</div><input className="input" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
                  <div><div className="label">Date d'echeance *</div><input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required /></div>
                  <div>
                    <div className="label">Mode de paiement</div>
                    <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                <hr className="divider" style={{ margin: "12px 0" }} />
                <div className="section-title">Classification</div>
                <div className="grid grid-2">
                  <div><div className="label">Categorie</div><select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></div>
                  <div><div className="label">Source</div><select className="select" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="label">Notes (optionnel)</div>
                  <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Commentaire, numero de commande, etc." maxLength={500} />
                </div>
                <div>
                  <div className="label">Document attache (optionnel, PDF/image max 20 Mo)</div>
                  <input className="input" type="file" accept="image/*,.pdf" onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)} />
                  {attachFile && <div className="tiny muted" style={{ marginTop: 4 }}>📎 {attachFile.name} ({Math.round(attachFile.size / 1024)} Ko)</div>}
                </div>
                <div className="row" style={{ marginTop: 16 }}>
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
              <p className="subtitle">Coordonnees, IBAN, notes par fournisseur</p>
            </div>
            <div className="card card-inner">
              <div className="space-between" style={{ marginBottom: 12 }}>
                <div className="small muted">{data.suppliers.length} fournisseur(s)</div>
                <button className="button" onClick={() => setCreatingSupplier(true)}>+ Nouveau fournisseur</button>
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead><tr><th>Nom</th><th>Contact</th><th>IBAN</th><th>TVA</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data.suppliers.map((s: any) => (
                      <tr key={s.id}>
                        <td data-label="Nom">
                          <strong>{s.name}</strong>
                          {s.contactName && <div className="tiny muted">{s.contactName}</div>}
                          {s.category && <div className="tiny"><span className="badge gray">{s.category}</span></div>}
                        </td>
                        <td data-label="Contact">
                          {s.email && <div className="small">✉ {s.email}</div>}
                          {s.phone && <div className="small">☏ {s.phone}</div>}
                          {s.address && <div className="tiny muted">{s.address}</div>}
                          {!s.email && !s.phone && <span className="muted">-</span>}
                        </td>
                        <td data-label="IBAN">
                          {s.iban ? <code style={{ fontSize: 11 }}>{s.iban}</code> : <span className="muted">-</span>}
                          {s.bic && <div className="tiny muted">BIC : {s.bic}</div>}
                        </td>
                        <td data-label="TVA">{s.vatNumber ? <code style={{ fontSize: 11 }}>{s.vatNumber}</code> : <span className="muted">-</span>}</td>
                        <td className="td-actions">
                          <div className="row">
                            <button className="button secondary sm" onClick={() => setEditingSupplier(s)}>Editer</button>
                            {(session.role === "ADMIN" || session.role === "ACCOUNTING") && <button className="button danger sm" onClick={() => setDeletingSupplier(s)}>Supprimer</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {data.suppliers.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 24 }} className="muted">Aucun fournisseur. Creez-en un.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Equipe */}
        {tab === "equipe" && session.role === "ADMIN" && (
          <div className="stack">
            <div className="page-header">
              <h1 className="title">Equipe</h1>
              <p className="subtitle">Gestion des utilisateurs et des roles</p>
            </div>
            <div className="card card-inner">
              <div className="space-between" style={{ marginBottom: 12 }}>
                <div className="small muted">{data.users.length} utilisateur(s)</div>
                <button className="button" onClick={() => setCreatingUser(true)}>+ Inviter un collaborateur</button>
              </div>
              <div className="table-responsive">
                <table className="table">
                  <thead><tr><th>Nom</th><th>Email</th><th>Role</th><th>Cree le</th><th>Actions</th></tr></thead>
                  <tbody>
                    {data.users.map((u: any) => {
                      const isMe = u.id === session.userId;
                      return (
                        <tr key={u.id}>
                          <td data-label="Nom">
                            <strong>{u.fullName}</strong>
                            {isMe && <span className="badge blue" style={{ marginLeft: 8, fontSize: 10 }}>Moi</span>}
                          </td>
                          <td data-label="Email" className="small">{u.email}</td>
                          <td data-label="Role"><span className="badge gray">{ROLE_LABELS[u.role] ?? u.role}</span></td>
                          <td data-label="Cree" className="small">{fmtDate(u.createdAt)}</td>
                          <td className="td-actions">
                            <div className="row">
                              <button className="button secondary sm" onClick={() => setEditingUser(u)}>Editer</button>
                              <button className="button secondary sm" onClick={() => setResettingUser(u)}>Reset mdp</button>
                              {!isMe && <button className="button danger sm" onClick={() => setDeletingUser(u)}>Supprimer</button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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
              <p className="subtitle">Informations, mot de passe et verification 2 facteurs</p>
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
            <TwoFactorCard />
          </div>
        )}

        {/* TAB: Rapports TVA */}
        {tab === "rapports" && (<VatReportTab fmt={fmt} />)}

        {/* TAB: Parametres entreprise */}
        {tab === "parametres" && session.role === "ADMIN" && (
          <SettingsTab initial={data.settings} onSaved={refreshData} />
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
        />
      )}

      {/* Modal: Delete invoice confirmation */}
      {deletingInvoice && (
        <div className="modal-overlay" onClick={() => setDeletingInvoice(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">Supprimer cette facture ?</div>
            <p className="small" style={{ marginTop: 12 }}>
              La facture <strong>{deletingInvoice.reference}</strong> ({deletingInvoice.supplier?.name}, {fmtCurrency(deletingInvoice.amount, deletingInvoice.currency)}) sera definitivement supprimee. Cette action est irreversible.
            </p>
            <div className="row" style={{ marginTop: 20, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setDeletingInvoice(null)}>Annuler</button>
              <button className="button danger" onClick={confirmDelete} disabled={loading === "delete"}>{loading === "delete" ? "Suppression..." : "Supprimer definitivement"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Supplier create/edit */}
      {(creatingSupplier || editingSupplier) && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => { setCreatingSupplier(false); setEditingSupplier(null); }}
          onSave={(data) => saveSupplier(data, editingSupplier?.id)}
          loading={loading === "supplier"}
        />
      )}

      {/* Modal: Supplier delete */}
      {deletingSupplier && (
        <div className="modal-overlay" onClick={() => setDeletingSupplier(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">Supprimer le fournisseur ?</div>
            <p className="small" style={{ marginTop: 12 }}><strong>{deletingSupplier.name}</strong> sera supprime. Si des factures utilisent encore ce fournisseur, l'operation sera refusee.</p>
            <div className="row" style={{ marginTop: 20, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setDeletingSupplier(null)}>Annuler</button>
              <button className="button danger" onClick={confirmDeleteSupplier} disabled={loading === "delete-supplier"}>{loading === "delete-supplier" ? "..." : "Supprimer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: User create/edit */}
      {(creatingUser || editingUser) && (
        <UserModal
          user={editingUser}
          onClose={() => { setCreatingUser(false); setEditingUser(null); }}
          onSave={(data) => saveUser(data, editingUser?.id)}
          loading={loading === "user"}
        />
      )}

      {/* Modal: Reset password */}
      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSave={resetUserPwd}
          loading={loading === "reset-pwd"}
        />
      )}

      {/* Modal: Paiement partiel */}
      {payingInvoice && (
        <PartialPaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSave={addPayment}
          loading={loading === "pay-partial"}
        />
      )}

      {/* Modal: OCR result */}
      {ocrResult && (
        <div className="modal-overlay" onClick={() => setOcrResult(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="space-between">
              <div className="section-title">Resultat OCR</div>
              <button className="button secondary sm" onClick={() => setOcrResult(null)} aria-label="Fermer">×</button>
            </div>
            <div className="tiny muted" style={{ marginTop: 8 }}>Confiance : {Math.round(ocrResult.confidence)}%</div>
            {ocrResult.extracted && (
              <div className="card card-inner" style={{ marginTop: 12, background: "#f8fafc" }}>
                <div className="section-title" style={{ fontSize: 14 }}>Donnees extraites</div>
                <div className="stack-sm tiny" style={{ marginTop: 10 }}>
                  {ocrResult.extracted.supplierName && <div><strong>Fournisseur:</strong> {ocrResult.extracted.supplierName}</div>}
                  {ocrResult.extracted.supplierReference && <div><strong>N° facture:</strong> {ocrResult.extracted.supplierReference}</div>}
                  {ocrResult.extracted.amount && <div><strong>Montant:</strong> {ocrResult.extracted.amount} {ocrResult.extracted.currency ?? ""}</div>}
                  {ocrResult.extracted.date && <div><strong>Date:</strong> {ocrResult.extracted.date}</div>}
                  {ocrResult.extracted.iban && <div><strong>IBAN:</strong> <code>{ocrResult.extracted.iban}</code></div>}
                  {ocrResult.extracted.supplierVat && <div><strong>N° TVA:</strong> {ocrResult.extracted.supplierVat}</div>}
                </div>
              </div>
            )}
            <details style={{ marginTop: 12 }}>
              <summary className="small" style={{ cursor: "pointer" }}>Voir le texte brut</summary>
              <pre style={{ background: "#0f172a", color: "#e2e8f0", padding: 12, borderRadius: 8, fontSize: 11, maxHeight: 300, overflow: "auto", marginTop: 8, whiteSpace: "pre-wrap" }}>{ocrResult.text}</pre>
            </details>
            <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setOcrResult(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: User delete */}
      {deletingUser && (
        <div className="modal-overlay" onClick={() => setDeletingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-title">Supprimer l'utilisateur ?</div>
            <p className="small" style={{ marginTop: 12 }}><strong>{deletingUser.fullName}</strong> ({deletingUser.email}) sera supprime. Les factures qui lui etaient assignees seront desassignees.</p>
            <div className="row" style={{ marginTop: 20, justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setDeletingUser(null)}>Annuler</button>
              <button className="button danger" onClick={confirmDeleteUser} disabled={loading === "delete-user"}>{loading === "delete-user" ? "..." : "Supprimer"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierModal({ supplier, onClose, onSave, loading }: {
  supplier: any; onClose: () => void; onSave: (p: any) => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    name: supplier?.name ?? "",
    contactName: supplier?.contactName ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    address: supplier?.address ?? "",
    iban: supplier?.iban ?? "",
    bic: supplier?.bic ?? "",
    vatNumber: supplier?.vatNumber ?? "",
    category: supplier?.category ?? "",
    notes: supplier?.notes ?? "",
  });
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      name: form.name,
      contactName: form.contactName || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      iban: form.iban || null,
      bic: form.bic || null,
      vatNumber: form.vatNumber || null,
      category: form.category || null,
      notes: form.notes || null,
    });
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="space-between">
          <div className="section-title">{supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}</div>
          <button className="button secondary sm" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <form className="stack-sm" onSubmit={submit} style={{ marginTop: 16 }}>
          <div className="grid grid-2">
            <div><div className="label">Nom *</div><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required minLength={2} /></div>
            <div><div className="label">Personne contact</div><input className="input" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} /></div>
          </div>
          <div className="grid grid-2">
            <div><div className="label">Email</div><input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><div className="label">Telephone</div><input className="input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <div><div className="label">Adresse</div><input className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Rue, NPA, Ville, Pays" /></div>
          <div className="grid grid-2">
            <div><div className="label">IBAN</div><input className="input" value={form.iban} onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value.toUpperCase().replace(/\s/g, "") }))} placeholder="CH12 3456..." /></div>
            <div><div className="label">BIC / SWIFT</div><input className="input" value={form.bic} onChange={(e) => setForm((f) => ({ ...f, bic: e.target.value.toUpperCase() }))} /></div>
          </div>
          <div className="grid grid-2">
            <div><div className="label">N° TVA</div><input className="input" value={form.vatNumber} onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))} placeholder="CHE-123.456.789" /></div>
            <div><div className="label">Categorie</div><select className="select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}><option value="">-</option>{categories.map((c) => <option key={c} value={CATEGORY_LABELS[c]}>{CATEGORY_LABELS[c]}</option>)}</select></div>
          </div>
          <div><div className="label">Notes</div><textarea className="textarea" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} maxLength={500} /></div>
          <div className="row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
            <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
            <button className="button" disabled={loading}>{loading ? "..." : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserModal({ user, onClose, onSave, loading }: {
  user: any; onClose: () => void; onSave: (p: any) => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    email: user?.email ?? "",
    fullName: user?.fullName ?? "",
    role: user?.role ?? "MANAGER",
    password: "",
  });
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: any = { email: form.email, fullName: form.fullName, role: form.role };
    if (!user) data.password = form.password;
    onSave(data);
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="space-between">
          <div className="section-title">{user ? "Modifier l'utilisateur" : "Inviter un collaborateur"}</div>
          <button className="button secondary sm" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <form className="stack-sm" onSubmit={submit} style={{ marginTop: 16 }}>
          <div><div className="label">Nom complet *</div><input className="input" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required minLength={2} /></div>
          <div><div className="label">Email *</div><input className="input" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required /></div>
          <div>
            <div className="label">Role *</div>
            <select className="select" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="ADMIN">Administrateur</option>
              <option value="ACCOUNTING">Comptabilite</option>
              <option value="MANAGER">Manager</option>
            </select>
          </div>
          {!user && (
            <div>
              <div className="label">Mot de passe initial * (8 car. mini)</div>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} autoComplete="new-password" />
              <div className="tiny muted" style={{ marginTop: 4 }}>Communique-le en prive a la personne. Elle pourra le changer ensuite.</div>
            </div>
          )}
          <div className="row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
            <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
            <button className="button" disabled={loading}>{loading ? "..." : user ? "Enregistrer" : "Creer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ CHARTS ============

function MonthlyChart({ invoices, fmt }: { invoices: any[]; fmt: (v: number) => string }) {
  const months: { key: string; label: string; ht: number; ttc: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }), ht: 0, ttc: 0 });
  }
  for (const inv of invoices) {
    const d = inv.issueDate ? new Date(inv.issueDate) : new Date(inv.dueDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === key);
    if (m) { m.ht += Number(inv.amountHt ?? inv.amount); m.ttc += Number(inv.amount); }
  }
  const max = Math.max(1, ...months.map((m) => m.ttc));
  const w = 600, h = 200, pad = 28, bw = (w - 2 * pad) / months.length * 0.7;

  return (
    <div className="card card-inner">
      <div className="section-title">Activite 6 derniers mois</div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "auto", marginTop: 12 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((r) => (
          <line key={r} x1={pad} x2={w - pad} y1={h - pad - r * (h - 2 * pad)} y2={h - pad - r * (h - 2 * pad)} stroke="#e2e8f0" strokeDasharray={r === 0 ? "0" : "3 3"} />
        ))}
        {months.map((m, i) => {
          const x = pad + i * (w - 2 * pad) / months.length + (w - 2 * pad) / months.length / 2 - bw / 2;
          const bh = (m.ttc / max) * (h - 2 * pad);
          return (
            <g key={m.key}>
              <rect x={x} y={h - pad - bh} width={bw} height={bh} fill="#3b82f6" rx={3}>
                <title>{m.label}: {fmt(m.ttc)}</title>
              </rect>
              <text x={x + bw / 2} y={h - pad + 14} textAnchor="middle" fontSize="11" fill="#64748b">{m.label}</text>
              {m.ttc > 0 && <text x={x + bw / 2} y={h - pad - bh - 4} textAnchor="middle" fontSize="10" fill="#0f172a" fontWeight="600">{Math.round(m.ttc)}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CategoryChart({ invoices, fmt }: { invoices: any[]; fmt: (v: number) => string }) {
  const tot: Record<string, number> = {};
  for (const inv of invoices) tot[inv.category] = (tot[inv.category] ?? 0) + Number(inv.amount);
  const entries = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((s, [, v]) => s + v, 0);
  const colors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#64748b", "#a855f7"];

  return (
    <div className="card card-inner">
      <div className="section-title">Repartition par categorie</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {entries.length === 0 && <div className="small muted">Aucune donnee</div>}
        {entries.map(([cat, val], i) => {
          const pct = sum > 0 ? (val / sum * 100) : 0;
          return (
            <div key={cat}>
              <div className="space-between tiny">
                <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                <strong>{fmt(val)} <span className="muted">({pct.toFixed(1)}%)</span></strong>
              </div>
              <div className="progress" style={{ marginTop: 4 }}>
                <span style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuppliersChart({ invoices, fmt }: { invoices: any[]; fmt: (v: number) => string }) {
  const tot: Record<string, number> = {};
  for (const inv of invoices) {
    const k = inv.supplier?.name ?? "?";
    tot[k] = (tot[k] ?? 0) + Number(inv.amount);
  }
  const top = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = top[0]?.[1] ?? 1;

  return (
    <div className="card card-inner">
      <div className="section-title">Top 5 fournisseurs</div>
      <div className="stack-sm" style={{ marginTop: 12 }}>
        {top.length === 0 && <div className="small muted">Aucune donnee</div>}
        {top.map(([name, val]) => (
          <div key={name}>
            <div className="space-between tiny"><span>{name}</span><strong>{fmt(val)}</strong></div>
            <div className="progress" style={{ marginTop: 4 }}><span className="bar-blue" style={{ width: `${val / max * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusChart({ invoices }: { invoices: any[] }) {
  const tot: Record<string, number> = {};
  for (const inv of invoices) tot[inv.status] = (tot[inv.status] ?? 0) + 1;
  const colors: Record<string, string> = {
    A_QUALIFIER: "#94a3b8", A_VALIDER: "#f59e0b", A_PAYER: "#3b82f6",
    REPORT_DEMANDE: "#f97316", PAYEE: "#22c55e", ARCHIVEE: "#cbd5e1",
  };
  const total = invoices.length;
  let acc = 0;
  const segs: { status: string; from: number; to: number; count: number; color: string }[] = [];
  for (const s of Object.keys(colors)) {
    const count = tot[s] ?? 0;
    if (count === 0) continue;
    segs.push({ status: s, from: acc, to: acc + count, count, color: colors[s] });
    acc += count;
  }

  return (
    <div className="card card-inner">
      <div className="section-title">Statuts des factures</div>
      {total === 0 ? <div className="small muted" style={{ marginTop: 12 }}>Aucune facture</div> : (
        <>
          <div style={{ display: "flex", marginTop: 16, height: 16, borderRadius: 8, overflow: "hidden", background: "#e2e8f0" }}>
            {segs.map((s) => (
              <div key={s.status} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} title={`${STATUS_LABELS[s.status]}: ${s.count}`} />
            ))}
          </div>
          <div className="stack-sm" style={{ marginTop: 14 }}>
            {segs.map((s) => (
              <div key={s.status} className="row tiny" style={{ justifyContent: "space-between" }}>
                <span className="row" style={{ gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
                  {STATUS_LABELS[s.status]}
                </span>
                <strong>{s.count}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TwoFactorCard() {
  const [status, setStatus] = useState<"idle" | "setup" | "loading">("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disablePwd, setDisablePwd] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setEnabled(!!d?.user?.totpEnabled)).catch(() => {});
  }, []);

  const startSetup = async () => {
    setStatus("loading"); setError(null);
    const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
    if (res.ok) {
      const d = await res.json(); setQrCode(d.qrCode); setSecret(d.secret); setStatus("setup");
    } else { setError("Erreur"); setStatus("idle"); }
  };

  const confirmEnable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(null);
    const res = await fetch("/api/auth/2fa/enable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: code }),
    });
    const d = await res.json();
    if (res.ok) { setBackupCodes(d.backupCodes); setEnabled(true); setStatus("idle"); setQrCode(null); setSecret(null); setCode(""); }
    else setError(d.error ?? "Code invalide");
  };

  const disable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setError(null);
    const res = await fetch("/api/auth/2fa/disable", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: disablePwd }),
    });
    if (res.ok) { setEnabled(false); setShowDisable(false); setDisablePwd(""); }
    else { const d = await res.json(); setError(d.error ?? "Erreur"); }
  };

  return (
    <div className="card card-inner">
      <div className="section-title">Verification a 2 facteurs (2FA)</div>
      <p className="small muted" style={{ marginTop: 8 }}>Securise ta connexion avec Google Authenticator, 1Password, Authy, etc.</p>

      {backupCodes && (
        <div style={{ marginTop: 12, padding: 14, background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 8 }}>
          <strong>⚠ Codes de secours (a conserver precieusement)</strong>
          <p className="tiny" style={{ margin: "6px 0 10px" }}>Si tu perds ton telephone, chaque code peut remplacer un code a 6 chiffres (usage unique). Ils ne seront plus affiches.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 4, fontFamily: "monospace" }}>
            {backupCodes.map((c) => <code key={c} style={{ background: "white", padding: "4px 8px", borderRadius: 4 }}>{c}</code>)}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="button secondary sm" onClick={() => navigator.clipboard?.writeText(backupCodes.join("\n"))}>Copier</button>
            <button className="button secondary sm" onClick={() => setBackupCodes(null)}>J'ai note, fermer</button>
          </div>
        </div>
      )}

      {enabled === null && <div className="small muted">Chargement...</div>}

      {enabled === false && status === "idle" && (
        <div style={{ marginTop: 12 }}>
          <div className="row"><span className="badge gray">Desactivee</span></div>
          <button className="button" style={{ marginTop: 12 }} onClick={startSetup} disabled={status === "loading" as any}>{status === "loading" as any ? "..." : "Activer la 2FA"}</button>
        </div>
      )}

      {status === "setup" && qrCode && (
        <form onSubmit={confirmEnable} className="stack-sm" style={{ marginTop: 12 }}>
          <div className="small">1. Scanne ce QR code avec ton app :</div>
          <img src={qrCode} alt="QR Code" style={{ width: 200, height: 200, background: "white", padding: 8, borderRadius: 8, border: "1px solid #e2e8f0" }} />
          <div className="tiny muted">Ou saisis manuellement : <code>{secret}</code></div>
          <div>
            <div className="label">2. Entre le code a 6 chiffres affiche par l'app</div>
            <input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} maxLength={6} inputMode="numeric" autoFocus required />
          </div>
          {error && <div className="badge red" style={{ padding: "6px 12px" }}>{error}</div>}
          <div className="row">
            <button className="button" type="submit">Activer</button>
            <button className="button secondary" type="button" onClick={() => { setStatus("idle"); setQrCode(null); setSecret(null); setCode(""); }}>Annuler</button>
          </div>
        </form>
      )}

      {enabled === true && (
        <div style={{ marginTop: 12 }}>
          <div className="row"><span className="badge green">Activee</span></div>
          {!showDisable ? (
            <button className="button secondary" style={{ marginTop: 12 }} onClick={() => setShowDisable(true)}>Desactiver la 2FA</button>
          ) : (
            <form onSubmit={disable} className="stack-sm" style={{ marginTop: 12 }}>
              <div><div className="label">Confirme avec ton mot de passe</div><input className="input" type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} required autoComplete="current-password" /></div>
              {error && <div className="badge red" style={{ padding: "6px 12px" }}>{error}</div>}
              <div className="row">
                <button className="button danger">Desactiver</button>
                <button className="button secondary" type="button" onClick={() => { setShowDisable(false); setDisablePwd(""); setError(null); }}>Annuler</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function VatReportTab({ fmt }: { fmt: (v: number) => string }) {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const qStart = new Date(now.getFullYear(), q * 3, 1);
  const qEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
  const [from, setFrom] = useState(qStart.toISOString().slice(0, 10));
  const [to, setTo] = useState(qEnd.toISOString().slice(0, 10));
  const [basedOn, setBasedOn] = useState<"issueDate" | "paymentDate">("issueDate");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/reports/vat?from=${from}&to=${to}&basedOn=${basedOn}`);
    if (res.ok) setReport(await res.json());
    setLoading(false);
  };

  const setQuarter = (year: number, quarter: number) => {
    const start = new Date(year, quarter * 3, 1);
    const end = new Date(year, quarter * 3 + 3, 0);
    setFrom(start.toISOString().slice(0, 10));
    setTo(end.toISOString().slice(0, 10));
  };

  const exportCsv = () => {
    if (!report) return;
    const rows = [
      ["Reference", "Fournisseur", "Date", "HT", "Taux TVA", "TVA", "TTC", "Devise"].join(","),
      ...report.invoices.map((i: any) => [
        i.reference, `"${(i.supplierName ?? "").replace(/"/g, '""')}"`,
        (i[basedOn] ?? "").slice(0, 10), i.amountHt ?? "", i.vatRate, i.vatAmount ?? "", i.amount, i.currency,
      ].join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `tva_${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack">
      <div className="page-header">
        <h1 className="title">Rapport TVA</h1>
        <p className="subtitle">Recapitulatif par periode (utile pour la declaration trimestrielle)</p>
      </div>
      <div className="card card-inner">
        <form onSubmit={generate} className="stack-sm">
          <div className="grid grid-3">
            <div><div className="label">Du</div><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><div className="label">Au</div><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div>
              <div className="label">Base sur</div>
              <select className="select" value={basedOn} onChange={(e) => setBasedOn(e.target.value as any)}>
                <option value="issueDate">Date d'emission</option>
                <option value="paymentDate">Date de paiement</option>
              </select>
            </div>
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
            {[0, 1, 2, 3].map((qi) => (
              <button key={qi} type="button" className="button secondary sm" onClick={() => setQuarter(now.getFullYear(), qi)}>
                T{qi + 1} {now.getFullYear()}
              </button>
            ))}
            <button type="button" className="button secondary sm" onClick={() => setQuarter(now.getFullYear() - 1, 3)}>T4 {now.getFullYear() - 1}</button>
            <button type="button" className="button secondary sm" onClick={() => { setFrom(`${now.getFullYear()}-01-01`); setTo(`${now.getFullYear()}-12-31`); }}>Annee {now.getFullYear()}</button>
          </div>
          <div className="row">
            <button className="button" disabled={loading}>{loading ? "..." : "Generer le rapport"}</button>
            {report && <button type="button" className="button secondary" onClick={exportCsv}>Exporter CSV</button>}
          </div>
        </form>
      </div>

      {report && (
        <>
          <div className="grid grid-3">
            <div className="card stat-card accent-blue"><div className="stat-label">Total HT</div><div className="stat-value">{fmt(report.totals.amountHt)}</div></div>
            <div className="card stat-card accent-purple"><div className="stat-label">Total TVA</div><div className="stat-value">{fmt(report.totals.vatAmount)}</div></div>
            <div className="card stat-card accent-green"><div className="stat-label">Total TTC</div><div className="stat-value">{fmt(report.totals.amountTtc)}</div><div className="stat-hint">{report.totals.count} facture(s)</div></div>
          </div>
          <div className="card card-inner">
            <div className="section-title">Ventilation par taux TVA</div>
            <div className="table-responsive" style={{ marginTop: 12 }}>
              <table className="table">
                <thead><tr><th>Taux</th><th>Devise</th><th>Factures</th><th>Total HT</th><th>Total TVA</th><th>Total TTC</th></tr></thead>
                <tbody>
                  {report.byRate.map((r: any, i: number) => (
                    <tr key={i}>
                      <td data-label="Taux"><strong>{r.rate}%</strong></td>
                      <td data-label="Devise">{r.currency}</td>
                      <td data-label="Factures">{r.count}</td>
                      <td data-label="HT" style={{ fontWeight: 600 }}>{fmtCurrency(r.amountHt, r.currency)}</td>
                      <td data-label="TVA" style={{ fontWeight: 600 }}>{fmtCurrency(r.vatAmount, r.currency)}</td>
                      <td data-label="TTC" style={{ fontWeight: 600 }}>{fmtCurrency(r.amountTtc, r.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SettingsTab({ initial, onSaved }: { initial: any; onSaved: () => void }) {
  const [form, setForm] = useState({
    companyName: initial.companyName ?? "",
    companyVat: initial.companyVat ?? "",
    companyAddress: initial.companyAddress ?? "",
    companyEmail: initial.companyEmail ?? "",
    companyPhone: initial.companyPhone ?? "",
    defaultCurrency: initial.defaultCurrency ?? "CHF",
    defaultVatRate: String(initial.defaultVatRate ?? 8.1),
    invoicePrefix: initial.invoicePrefix ?? "FAC",
    overdueReminders: !!initial.overdueReminders,
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setLoading(true); setMsg(null);
    const res = await fetch("/api/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: form.companyName || null,
        companyVat: form.companyVat || null,
        companyAddress: form.companyAddress || null,
        companyEmail: form.companyEmail || null,
        companyPhone: form.companyPhone || null,
        defaultCurrency: form.defaultCurrency,
        defaultVatRate: Number(form.defaultVatRate),
        invoicePrefix: form.invoicePrefix,
        overdueReminders: form.overdueReminders,
      }),
    });
    if (res.ok) { setMsg({ t: "ok", m: "Parametres enregistres" }); onSaved(); }
    else { const d = await res.json(); setMsg({ t: "err", m: d.error ?? "Erreur" }); }
    setLoading(false);
  };

  return (
    <div className="stack">
      <div className="page-header">
        <h1 className="title">Parametres entreprise</h1>
        <p className="subtitle">Informations, devise et prefixe de numerotation</p>
      </div>
      <div className="card card-inner">
        <form className="stack-sm" onSubmit={submit}>
          <div className="section-title">Mon entreprise</div>
          <div className="grid grid-2">
            <div><div className="label">Nom de l'entreprise</div><input className="input" value={form.companyName} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="Acme SA" /></div>
            <div><div className="label">N° de TVA</div><input className="input" value={form.companyVat} onChange={(e) => setForm((f) => ({ ...f, companyVat: e.target.value }))} placeholder="CHE-123.456.789" /></div>
          </div>
          <div><div className="label">Adresse complete</div><input className="input" value={form.companyAddress} onChange={(e) => setForm((f) => ({ ...f, companyAddress: e.target.value }))} placeholder="Rue, NPA, Ville" /></div>
          <div className="grid grid-2">
            <div><div className="label">Email</div><input className="input" type="email" value={form.companyEmail} onChange={(e) => setForm((f) => ({ ...f, companyEmail: e.target.value }))} /></div>
            <div><div className="label">Telephone</div><input className="input" value={form.companyPhone} onChange={(e) => setForm((f) => ({ ...f, companyPhone: e.target.value }))} /></div>
          </div>

          <hr className="divider" style={{ margin: "16px 0" }} />
          <div className="section-title">Valeurs par defaut</div>
          <div className="grid grid-3">
            <div>
              <div className="label">Devise par defaut</div>
              <select className="select" value={form.defaultCurrency} onChange={(e) => setForm((f) => ({ ...f, defaultCurrency: e.target.value }))}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
            <div>
              <div className="label">Taux TVA par defaut</div>
              <input className="input" type="number" step="0.1" min="0" max="100" value={form.defaultVatRate} onChange={(e) => setForm((f) => ({ ...f, defaultVatRate: e.target.value }))} />
            </div>
            <div>
              <div className="label">Prefixe de numerotation</div>
              <input className="input" value={form.invoicePrefix} onChange={(e) => setForm((f) => ({ ...f, invoicePrefix: e.target.value.toUpperCase() }))} maxLength={20} placeholder="FAC" />
            </div>
          </div>

          <hr className="divider" style={{ margin: "16px 0" }} />
          <div className="section-title">Notifications</div>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={form.overdueReminders} onChange={(e) => setForm((f) => ({ ...f, overdueReminders: e.target.checked }))} />
            <span className="small">Envoyer un email aux admins/compta chaque matin si des factures sont en retard</span>
          </label>
          <div className="tiny muted">
            Requiert la configuration SMTP (variables d'env SMTP_HOST, SMTP_USER, SMTP_PASS). Le cron doit etre active cote serveur.
          </div>

          {msg && <div className={`badge ${msg.t === "ok" ? "green" : "red"}`} style={{ padding: "8px 12px" }}>{msg.m}</div>}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="button" disabled={loading}>{loading ? "..." : "Enregistrer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PartialPaymentModal({ invoice, onClose, onSave, loading }: {
  invoice: any; onClose: () => void; onSave: (amount: number, paidAt: string, method: string, note: string) => void; loading: boolean;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(invoice.paymentMethod ?? "VIREMENT");
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch(`/api/invoices/${invoice.id}/payments`).then((r) => r.json()).then((d) => setPayments(d.payments ?? [])).catch(() => {});
  }, [invoice.id]);

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Number(invoice.amount) - totalPaid;
  const fmt = (v: number) => fmtCurrency(v, invoice.currency);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(Number(amount), paidAt, method, note);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="space-between">
          <div className="section-title">Paiement partiel - {invoice.reference}</div>
          <button className="button secondary sm" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="grid grid-3" style={{ marginTop: 12 }}>
          <div className="card stat-card accent-blue"><div className="stat-label">Total du</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(Number(invoice.amount))}</div></div>
          <div className="card stat-card accent-green"><div className="stat-label">Deja paye</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(totalPaid)}</div></div>
          <div className="card stat-card accent-red"><div className="stat-label">Restant</div><div className="stat-value" style={{ fontSize: 20 }}>{fmt(Math.max(0, remaining))}</div></div>
        </div>

        {payments.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Paiements enregistres</div>
            <div className="table-responsive" style={{ marginTop: 8 }}>
              <table className="table">
                <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Note</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td data-label="Date">{fmtDate(p.paidAt)}</td>
                      <td data-label="Montant" style={{ fontWeight: 600 }}>{fmtCurrency(p.amount, p.currency)}</td>
                      <td data-label="Mode">{PAYMENT_METHOD_LABELS[p.method ?? ""] ?? "-"}</td>
                      <td data-label="Note" className="small muted">{p.note ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {remaining > 0 && (
          <form onSubmit={submit} className="stack-sm" style={{ marginTop: 16 }}>
            <div className="section-title" style={{ fontSize: 14 }}>Ajouter un paiement</div>
            <div className="grid grid-3">
              <div>
                <div className="label">Montant ({invoice.currency})</div>
                <input className="input" type="number" min="0.01" step="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div><div className="label">Date</div><input className="input" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required /></div>
              <div>
                <div className="label">Mode</div>
                <select className="select" value={method} onChange={(e) => setMethod(e.target.value)}>
                  {PAYMENT_METHODS.filter((p) => p.value).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div className="label">Note (optionnel)</div>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="button secondary" onClick={() => setAmount(String(remaining))}>Tout restant ({fmt(remaining)})</button>
              <button className="button" disabled={loading}>{loading ? "..." : "Enregistrer"}</button>
            </div>
          </form>
        )}
        {remaining <= 0 && <div className="badge green" style={{ padding: "10px 14px", marginTop: 16 }}>Facture entierement payee</div>}
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSave, loading }: {
  user: any; onClose: () => void; onSave: (pwd: string) => void; loading: boolean;
}) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const generate = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 16; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPwd(p); setShow(true);
  };
  const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); onSave(pwd); };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="space-between">
          <div className="section-title">Reinitialiser le mot de passe</div>
          <button className="button secondary sm" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <p className="small" style={{ marginTop: 8 }}>Nouveau mot de passe pour <strong>{user.fullName}</strong> ({user.email}).</p>
        <form className="stack-sm" onSubmit={submit} style={{ marginTop: 12 }}>
          <div>
            <div className="label">Nouveau mot de passe (8 car. mini)</div>
            <input className="input" type={show ? "text" : "password"} value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={8} />
            <div className="row" style={{ marginTop: 6, gap: 8 }}>
              <button type="button" className="button secondary sm" onClick={generate}>Generer</button>
              <button type="button" className="button secondary sm" onClick={() => setShow((s) => !s)}>{show ? "Masquer" : "Afficher"}</button>
              {show && pwd && <button type="button" className="button secondary sm" onClick={() => navigator.clipboard?.writeText(pwd)}>Copier</button>}
            </div>
          </div>
          <div className="tiny muted">⚠ Note ce mot de passe, il ne sera plus visible apres validation.</div>
          <div className="row" style={{ marginTop: 8, justifyContent: "flex-end" }}>
            <button type="button" className="button secondary" onClick={onClose}>Annuler</button>
            <button className="button danger" disabled={loading || pwd.length < 8}>{loading ? "..." : "Reinitialiser"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditInvoiceModal({ invoice, suppliers, onClose, onSave, loading }: {
  invoice: any; suppliers: any[]; onClose: () => void; onSave: (p: any) => void; loading: boolean;
}) {
  const [form, setForm] = useState({
    reference: invoice.reference,
    supplierReference: invoice.supplierReference ?? "",
    supplierName: invoice.supplier?.name ?? "",
    amount: String(invoice.amount),
    vatRate: String(invoice.vatRate ?? 0),
    currency: invoice.currency ?? "CHF",
    issueDate: invoice.issueDate ? invoice.issueDate.slice(0, 10) : "",
    dueDate: invoice.dueDate.slice(0, 10),
    paymentMethod: invoice.paymentMethod ?? "",
    category: invoice.category,
    source: invoice.source,
    notes: invoice.notes ?? "",
  });

  const amountNum = Number(form.amount) || 0;
  const vatNum = Number(form.vatRate) || 0;
  const ht = vatNum > 0 ? amountNum / (1 + vatNum / 100) : amountNum;
  const tva = amountNum - ht;
  const fmt = (v: number) => fmtCurrency(v, form.currency);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave({
      reference: form.reference,
      supplierReference: form.supplierReference || null,
      supplierName: form.supplierName,
      amount: Number(form.amount),
      vatRate: Number(form.vatRate),
      currency: form.currency,
      issueDate: form.issueDate || null,
      dueDate: form.dueDate,
      paymentMethod: form.paymentMethod || null,
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
            <div><div className="label">Reference interne</div><input className="input" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} required /></div>
            <div><div className="label">N° facture fournisseur</div><input className="input" value={form.supplierReference} onChange={(e) => setForm((f) => ({ ...f, supplierReference: e.target.value }))} /></div>
          </div>
          <div>
            <div className="label">Fournisseur</div>
            <input className="input" list="edit-supplier-list" value={form.supplierName} onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))} required />
            <datalist id="edit-supplier-list">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </div>
          <div className="grid grid-3">
            <div><div className="label">Montant TTC</div><input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required /></div>
            <div><div className="label">Devise</div><select className="select" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>
            <div>
              <div className="label">Taux TVA</div>
              <select className="select" value={form.vatRate} onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))}>
                {VAT_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          {amountNum > 0 && vatNum > 0 && (
            <div className="tiny" style={{ background: "#f0f9ff", padding: "8px 12px", borderRadius: 8, border: "1px solid #bae6fd" }}>
              HT : <strong>{fmt(ht)}</strong> · TVA : <strong>{fmt(tva)}</strong> · TTC : <strong>{fmt(amountNum)}</strong>
            </div>
          )}
          <div className="grid grid-3">
            <div><div className="label">Date d'emission</div><input className="input" type="date" value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} /></div>
            <div><div className="label">Date d'echeance</div><input className="input" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} required /></div>
            <div>
              <div className="label">Mode de paiement</div>
              <select className="select" value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
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
