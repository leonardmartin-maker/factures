# Version 6 - Next.js production-ready + Prisma + Docker + validation

Cette V6 est la version la plus aboutie du dossier. Elle vise une base **prête pour un vrai projet d'entreprise** et non plus seulement une démo.

## Ce que la V6 apporte de plus

Par rapport à la V5, cette version ajoute une structure plus solide pour la production :

- **Prisma branché comme couche principale**
- **seed de démonstration**
- **authentification par session signée** avec `jose`
- **validation d'entrées avec Zod**
- **upload de pièces jointes** dans un dossier local remplaçable
- **OCR simulé** sur les documents importés
- **API métier plus propre** : création, changement de statut, report, paiement, export CSV, budget
- **Docker Compose** pour lancer PostgreSQL rapidement
- **journal d'audit** pour les actions critiques
- **dashboard SSR** protégé

## Stack

- Next.js 14 (App Router)
- TypeScript
- Prisma
- PostgreSQL
- Zod
- bcryptjs
- jose

## Comptes seedés

Mot de passe commun : `demo123`

- `admin@entreprise.local` → `ADMIN`
- `compta@entreprise.local` → `ACCOUNTING`
- `manager@entreprise.local` → `MANAGER`

## Démarrage local

```bash
docker compose up -d
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Fonctionnalités couvertes

- login / logout
- factures à payer / à valider / report demandé / payées / archivées
- paiement d'une facture avec date de paiement
- demande de report avec motif
- ventilation comptable
- budget achats / dépenses / réserve
- fournisseurs
- audit des actions
- export CSV
- import de document et pré-analyse OCR simulée

## Structure

- `src/app` : pages et routes API
- `src/components` : interface utilisateur
- `src/lib` : auth, DB, repository, validation, dashboard, OCR
- `prisma/schema.prisma` : schéma PostgreSQL
- `prisma/seed.ts` : données de démonstration
- `docker-compose.yml` : PostgreSQL local

## Points à brancher pour la prod

- stockage objet type S3 / Cloudflare R2 / MinIO
- vrai OCR type Mindee / Document AI / Textract
- mots de passe forcés et rotation des secrets
- relances automatiques via cron / file de jobs
- système d'autorisations plus fin par société / établissement
- export comptable vers l'outil cible
