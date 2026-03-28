import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { getSessionFromRequestCookies } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSessionFromRequestCookies();

  if (session) {
    redirect("/");
  }

  return (
    <main className="container" style={{ maxWidth: 560, minHeight: "100vh", display: "flex", alignItems: "center" }}>
      <div className="card" style={{ width: "100%", padding: 28 }}>
        <div className="stack">
          <div>
            <div className="badge blue">Version 6</div>
            <h1 className="title" style={{ margin: "14px 0 8px" }}>Connexion</h1>
            <p className="subtitle">Accede a l'application de gestion des factures professionnelles.</p>
          </div>

          <div className="card" style={{ padding: 16, background: "#f8fafc" }}>
            <strong>Comptes de demonstration</strong>
            <div className="small muted" style={{ marginTop: 8 }}>
              admin@entreprise.local / demo123<br />
              compta@entreprise.local / demo123<br />
              manager@entreprise.local / demo123
            </div>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
