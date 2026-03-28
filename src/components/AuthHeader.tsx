"use client";

import { useRouter } from "next/navigation";
import type { SessionPayload } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  ACCOUNTING: "Comptabilite",
  MANAGER: "Manager",
};

export default function AuthHeader({ session }: { session: SessionPayload }) {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="card card-inner">
      <div className="space-between">
        <div>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <span className="badge blue">V6</span>
            <span className="badge purple">Production</span>
          </div>
          <h1 className="title">Gestion des factures</h1>
          <p className="subtitle" style={{ marginTop: 6 }}>
            Suivi des echeances, budget, reserve, audit et export.
          </p>
        </div>

        <div className="row" style={{ gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{session.fullName}</div>
            <div className="tiny muted">{session.email}</div>
            <div className="badge gray" style={{ marginTop: 6 }}>{ROLE_LABELS[session.role] ?? session.role}</div>
          </div>
          <button className="button secondary sm" onClick={logout}>Deconnexion</button>
        </div>
      </div>
    </header>
  );
}
