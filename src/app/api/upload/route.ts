import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runOcrSimulation } from "@/lib/ocr";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { attachDocumentToInvoice } from "@/lib/repositories";

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const invoiceId = formData.get("invoiceId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  // Limite de taille 20 Mo
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 400 });
  }

  const uploadDir = process.env.UPLOAD_DIR ?? "./storage/uploads";
  const absoluteUploadDir = path.resolve(process.cwd(), uploadDir);
  await mkdir(absoluteUploadDir, { recursive: true });

  const extension = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const storageName = `${randomUUID()}${extension}`;
  const storagePath = path.join(absoluteUploadDir, storageName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(storagePath, buffer);

  const analysis = runOcrSimulation(file.name, file.type, buffer.length);

  // Si invoiceId fourni, on lie le document
  let document = null;
  if (typeof invoiceId === "string" && invoiceId) {
    document = await attachDocumentToInvoice({
      invoiceId,
      filename: file.name,
      mimeType: file.type,
      storagePath,
      originalSize: buffer.length,
      userId: session.userId,
    });
  }

  return NextResponse.json({
    ok: true,
    file: { originalName: file.name, mimeType: file.type, size: buffer.length, storagePath },
    document: document ? { id: document.id, filename: document.filename } : null,
    analysis,
  });
}
