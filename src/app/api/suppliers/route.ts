import { NextResponse } from "next/server";
import { listSuppliers } from "@/lib/repositories";

export async function GET() {
  const suppliers = await listSuppliers();
  return NextResponse.json({ suppliers });
}
