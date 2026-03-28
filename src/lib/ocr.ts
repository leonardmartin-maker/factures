export function runOcrSimulation(filename: string, mimeType: string, size: number) {
  const normalized = filename.toLowerCase();

  if (normalized.includes("axa")) {
    return {
      supplierName: "AXA Entreprises",
      amount: 1240,
      dueDate: "2026-04-05",
      confidence: 0.96,
      mimeType,
      size,
    };
  }

  if (normalized.includes("orange")) {
    return {
      supplierName: "Orange Pro",
      amount: 199,
      dueDate: "2026-03-14",
      confidence: 0.94,
      mimeType,
      size,
    };
  }

  return {
    supplierName: "Fournisseur a verifier",
    amount: 0,
    dueDate: "2026-04-10",
    confidence: 0.71,
    mimeType,
    size,
  };
}
