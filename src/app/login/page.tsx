import { redirect } from "next/navigation";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { getSessionFromRequestCookies } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSessionFromRequestCookies();

  if (session) {
    redirect("/");
  }

  return (
    <div className="login-wrapper">
      <div className="card login-card">
        <div className="stack">
          <div>
            <div className="row" style={{ gap: 8, marginBottom: 14 }}>
              <span className="badge blue">V6</span>
              <span className="badge purple">Production</span>
            </div>
            <h1 className="title">Connexion</h1>
            <p className="subtitle" style={{ marginTop: 8 }}>
              Accedez a la gestion des factures professionnelles.
            </p>
          </div>

          <div className="demo-box">
            <strong>Comptes de demonstration</strong>
            <div className="muted" style={{ marginTop: 8, lineHeight: 1.8 }}>
              <code>admin@entreprise.local</code><br />
              <code>compta@entreprise.local</code><br />
              <code>manager@entreprise.local</code><br />
              Mot de passe : <code>demo123</code>
            </div>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
