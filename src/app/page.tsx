import { redirect } from "next/navigation";
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

  return <DashboardClient initialData={dashboard} session={session} />;
}
