"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setSubmitted(true);
    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <div className="stack">
          <div>
            <h1 className="title">Mot de passe oublie</h1>
            <p className="subtitle" style={{ marginTop: 8 }}>Entrez votre email, vous recevrez un lien de reinitialisation.</p>
          </div>
          {submitted ? (
            <div className="badge green" style={{ padding: "12px 16px", whiteSpace: "normal" }}>
              Si un compte existe pour cet email, un lien de reinitialisation a ete envoye (verifiez vos spams).
            </div>
          ) : (
            <form className="stack" onSubmit={submit}>
              <label className="stack small">
                <span>Email</span>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </label>
              <button className="button" disabled={loading}>{loading ? "Envoi..." : "Envoyer le lien"}</button>
            </form>
          )}
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href="/login" className="small muted">Retour a la connexion</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
