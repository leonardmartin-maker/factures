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
            <h1 className="title">Factures Pro</h1>
            <p className="subtitle" style={{ marginTop: 8 }}>
              Connectez-vous pour acceder a votre espace.
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
