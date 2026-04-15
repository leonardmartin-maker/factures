import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { getSessionFromRequestCookies } from "@/lib/auth";
import { getDocumentById } from "@/lib/repositories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Extrait grossierement les infos d'une facture a partir du texte OCR
function extractFromOcrText(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const result: any = { rawText: text };

  // Montant: cherche les patterns "xxx.xx CHF/EUR/USD" ou "Total xxx"
  const amountMatch = text.match(/(?:total|ttc|montant|amount|a\s*payer)[^\d]{0,30}([0-9][0-9'\s]*[.,]\d{2})/i);
  if (amountMatch) {
    const raw = amountMatch[1].replace(/[\s']/g, "").replace(",", ".");
    result.amount = parseFloat(raw);
  }
  // Devise
  const currencyMatch = text.match(/\b(CHF|EUR|USD|GBP)\b/i);
  if (currencyMatch) result.currency = currencyMatch[1].toUpperCase();
  // IBAN
  const ibanMatch = text.match(/\b([A-Z]{2}[0-9]{2}[A-Z0-9\s]{10,40})\b/);
  if (ibanMatch) result.iban = ibanMatch[1].replace(/\s/g, "");
  // Date (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD)
  const dateMatch = text.match(/\b(\d{2})[./](\d{2})[./](\d{4})\b/) || text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (dateMatch) {
    if (dateMatch[0].includes("-")) result.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    else result.date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
  }
  // N° TVA suisse
  const vatMatch = text.match(/CHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}/i);
  if (vatMatch) result.supplierVat = vatMatch[0];
  // Numero de facture
  const invoiceNrMatch = text.match(/(?:facture|invoice|rechnung|n[°o]?)\s*[:#]?\s*([A-Z0-9-\/]{4,25})/i);
  if (invoiceNrMatch) result.supplierReference = invoiceNrMatch[1];
  // Nom du fournisseur : on prend la 1re ligne significative (souvent l'en-tete)
  if (lines.length > 0) result.supplierName = lines.slice(0, 3).join(" ").slice(0, 80);

  return result;
}

export async function POST(request: Request) {
  const session = await getSessionFromRequestCookies();
  if (!session) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");
  const lang = url.searchParams.get("lang") ?? "fra+eng+deu";

  if (!documentId) return NextResponse.json({ error: "documentId requis" }, { status: 400 });

  const doc = await getDocumentById(documentId);
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  try {
    const buffer = await readFile(doc.storagePath);
    // Import dynamique de tesseract.js
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(lang, undefined, { logger: () => {} });
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    const extracted = extractFromOcrText(data.text);
    return NextResponse.json({ ok: true, text: data.text, confidence: data.confidence, extracted });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur OCR" }, { status: 500 });
  }
}
