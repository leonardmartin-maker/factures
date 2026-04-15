import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import { updateSettingsSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Permission refusee" }, { status: 403 });
  const body = await request.json();
  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  const settings = await updateSettings(parsed.data as any);
  return NextResponse.json({ settings });
}
