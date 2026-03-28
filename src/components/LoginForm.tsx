"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("admin@entreprise.local");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Connexion impossible");
      setLoading(false);
      return;
    }

    router.push(searchParams.get("next") || "/");
    router.refresh();
  };

  return (
    <form className="stack" onSubmit={onSubmit}>
      <label className="stack small">
        <span>Email</span>
        <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>

      <label className="stack small">
        <span>Mot de passe</span>
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>

      {error ? <div className="badge red">{error}</div> : null}
      <button className="button" disabled={loading}>{loading ? "Connexion..." : "Se connecter"}</button>
    </form>
  );
}
