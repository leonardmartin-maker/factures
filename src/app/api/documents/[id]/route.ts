import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { deleteDocument, getDocumentById } from "@/lib/repositories";
import { unlink } from "node:fs/promises";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const doc = await getDocumentById(params.id);
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  try {
    const buffer = await readFile(doc.storagePath);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const headers: Record<string, string> = {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Length": String(buffer.byteLength),
    };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${encodeURIComponent(doc.filename)}"`;
    } else {
      headers["Content-Disposition"] = `inline; filename="${encodeURIComponent(doc.filename)}"`;
    }
    return new NextResponse(buffer, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "Fichier non disponible" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  try {
    const doc = await deleteDocument(params.id, session.userId);
    // Best-effort suppression du fichier physique
    try { await unlink(doc.storagePath); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur" }, { status: 400 });
  }
}
