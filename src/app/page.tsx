import { redirect } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import DashboardClient from "@/components/DashboardClient";
import { getDashboardData } from "@/lib/dashboard";
import { getSessionFromRequestCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSessionFromRequestCookies();

  if (!session) {
    redirect("/login");
  }

  const dashboard = await getDashboardData();

  return (
    <main className="container stack">
      <AuthHeader session={session} />
      <DashboardClient initialData={dashboard} session={session} />
    </main>
  );
}
