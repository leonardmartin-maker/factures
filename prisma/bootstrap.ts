/**
 * Bootstrap script - cree le premier compte admin a partir des variables d'env.
 * Lu au demarrage de l'app ou via `npm run bootstrap`.
 *
 * Variables requises:
 *   ADMIN_EMAIL     - email du compte admin
 *   ADMIN_PASSWORD  - mot de passe (hashe avec bcrypt)
 *   ADMIN_NAME      - nom complet affiche dans l'UI (optionnel)
 *
 * Idempotent : si l'admin existe deja, on ne fait rien sauf si ADMIN_RESET_PASSWORD=1.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || "Administrateur";
  const reset = process.env.ADMIN_RESET_PASSWORD === "1";

  if (!email || !password) {
    console.log("[bootstrap] ADMIN_EMAIL / ADMIN_PASSWORD non definis, skip.");
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && !reset) {
    console.log(`[bootstrap] Admin ${email} existe deja, skip.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, fullName, role: "ADMIN" },
    });
    console.log(`[bootstrap] Mot de passe de ${email} reinitialise.`);
  } else {
    await prisma.user.create({
      data: { email, fullName, role: "ADMIN", passwordHash },
    });
    console.log(`[bootstrap] Admin ${email} cree.`);
  }
}

main()
  .catch((e) => {
    console.error("[bootstrap] Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
