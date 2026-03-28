import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestion factures V6",
  description: "Application web de gestion des factures professionnelles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
