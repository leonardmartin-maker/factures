"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpToken, setTotpToken] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const body: any = { email, password };
    if (mfaRequired) {
      if (useBackup) body.backupCode = backupCode;
      else body.totpToken = totpToken;
    }

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok && data.ok) {
      router.push(searchParams.get("next") || "/");
      router.refresh();
      return;
    }

    if (data.mfaRequired) {
      setMfaRequired(true);
      if (data.error) setError(data.error);
    } else {
      setError(data.error ?? "Connexion impossible");
    }
    setLoading(false);
  };

  return (
    <form className="stack" onSubmit={onSubmit}>
      {!mfaRequired && (
        <>
          <label className="stack small">
            <span>Email</span>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="stack small">
            <span>Mot de passe</span>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </label>
        </>
      )}

      {mfaRequired && (
        <div className="stack-sm">
          <div className="badge blue" style={{ padding: "8px 12px", whiteSpace: "normal" }}>
            Verification en 2 etapes requise
          </div>
          {!useBackup ? (
            <label className="stack small">
              <span>Code a 6 chiffres (application authentificateur)</span>
              <input className="input" value={totpToken} onChange={(e) => setTotpToken(e.target.value.replace(/\s/g, ""))} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus required />
            </label>
          ) : (
            <label className="stack small">
              <span>Code de secours</span>
              <input className="input" value={backupCode} onChange={(e) => setBackupCode(e.target.value.toUpperCase())} autoFocus required />
            </label>
          )}
          <button type="button" className="tiny" style={{ background: "none", border: 0, color: "#3b82f6", cursor: "pointer", textAlign: "left" }} onClick={() => setUseBackup((u) => !u)}>
            {useBackup ? "← Utiliser le code de l'application" : "Utiliser un code de secours →"}
          </button>
        </div>
      )}

      {error ? <div className="badge red">{error}</div> : null}
      <button className="button" disabled={loading}>{loading ? "Connexion..." : (mfaRequired ? "Verifier" : "Se connecter")}</button>
      {!mfaRequired && (
        <div className="row" style={{ justifyContent: "center", marginTop: 4 }}>
          <Link href="/forgot-password" className="tiny muted">Mot de passe oublie ?</Link>
        </div>
      )}
    </form>
  );
}
