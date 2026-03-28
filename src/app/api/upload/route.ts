import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { runOcrSimulation } from "@/lib/ocr";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
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

  return NextResponse.json({
    ok: true,
    file: {
      originalName: file.name,
      mimeType: file.type,
      size: buffer.length,
      storagePath,
    },
    analysis,
  });
}
