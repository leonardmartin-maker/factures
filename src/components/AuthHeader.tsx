"use client";

import { useRouter } from "next/navigation";
import type { SessionPayload } from "@/lib/auth";

export default function AuthHeader({ session }: { session: SessionPayload }) {
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="card" style={{ padding: 20 }}>
      <div className="space-between">
        <div>
          <div className="badge blue">Version 6 production-ready</div>
          <h1 className="title" style={{ fontSize: 34, margin: "10px 0 8px" }}>Gestion des factures professionnelles</h1>
          <p className="subtitle">Zero papier, suivi des echeances, budget, reserve, audit et export.</p>
        </div>

        <div className="row">
          <div className="card" style={{ padding: 14, minWidth: 240 }}>
            <div style={{ fontWeight: 700 }}>{session.fullName}</div>
            <div className="small muted">{session.email}</div>
            <div className="tiny muted">Role : {session.role}</div>
          </div>
          <button className="button secondary" onClick={logout}>Se deconnecter</button>
        </div>
      </div>
    </header>
  );
}
