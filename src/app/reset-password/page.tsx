"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return <div className="badge red" style={{ padding: "12px 16px" }}>Lien invalide</div>;
  }

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas"); return; }
    if (password.length < 8) { setError("8 caracteres minimum"); return; }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    const data = await res.json();
    if (res.ok) {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } else {
      setError(data.error ?? "Erreur");
    }
    setLoading(false);
  };

  if (success) {
    return <div className="badge green" style={{ padding: "12px 16px" }}>Mot de passe modifie. Redirection vers la connexion...</div>;
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label className="stack small"><span>Nouveau mot de passe (8 car. mini)</span>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
      </label>
      <label className="stack small"><span>Confirmer</span>
        <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
      </label>
      {error && <div className="badge red">{error}</div>}
      <button className="button" disabled={loading}>{loading ? "..." : "Reinitialiser"}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <div className="stack">
          <h1 className="title">Nouveau mot de passe</h1>
          <Suspense><ResetForm /></Suspense>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href="/login" className="small muted">Retour a la connexion</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
