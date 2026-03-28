import { NextResponse } from "next/server";
import { updateBudgetSchema } from "@/lib/validators";
import { getLatestBudget, upsertBudget } from "@/lib/repositories";

export async function GET() {
  const budget = await getLatestBudget();
  return NextResponse.json({ budget });
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = updateBudgetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides", details: parsed.error.flatten() }, { status: 400 });
  }

  const budget = await upsertBudget(parsed.data);
  return NextResponse.json({ budget });
}
