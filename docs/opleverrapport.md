# LinkConnect opleverrapport

## 1. Aangepast

Het bestaande statische Vercel-project is binnen dezelfde repository omgebouwd naar een Next.js App Router-platform. De donkerblauwe LinkConnect-stijl, bestaande logo-assets en foundersfoto zijn behouden. De positionering is volledig gericht op zakelijke leadafname: geen abonnement, betalen per lead, standaard minimaal twee leads per week.

## 2. Databasewijzigingen

Prisma/PostgreSQL bevat daarnaast source-scoped `LeadSource`-records, structured consent, transactionele `IngestReplay`-claims en een duurzame `OutboxEvent`-queue. De additieve candidate-migratie introduceert `Opportunity`, `CandidateProfile`, `OpportunityConsent`, `OpportunityAllocation`, candidate preferences en per-producttype weekly commitments. Bestaande leads en facturen blijven intact; development seeddata is geblokkeerd in productie.

## 3. Pagina’s en routes

Openbaar: home, hoe het werkt, voor bedrijven, leadcategorieën, kosten, FAQ, contact, inloggen, aanmelden, privacy, algemene voorwaarden, leadvoorwaarden en cookiebeleid.

Bedrijf: onboarding, overzicht, leads, leaddetail, kandidaten, kandidaatdetail, facturen, betalingen, voorkeuren, bedrijfsgegevens, instellingen en support.

Admin: overzicht en routes voor leads, bedrijven, toewijzingen, categorieën, prijzen, facturen, betalingen, geschillen, integraties en instellingen.

## 4. API-endpoints

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `POST /api/onboarding`, `POST /api/billing/sepa-setup`
- `POST /api/leads` voor transactionele source-scoped ingest; matching gebeurt daarna asynchroon
- `POST /api/candidates` voor transactionele kandidaat-ingest met verplichte consent-evidence; matching gebeurt daarna asynchroon
- `PATCH /api/candidates/:id/status` voor tenant-scoped kandidaatstatus
- `GET|POST /api/internal/outbox` voor de met `CRON_SECRET` beveiligde worker
- `GET /api/allocations`, `POST /api/allocations/:id/disputes`
- `POST /api/leads/:id/status`
- `POST /api/company/profile`, `/preferences`, `/settings`
- `POST /api/support`, `GET /api/me`
- `POST /api/webhooks/stripe`
- `GET /api/invoices/:id/download` met tenantcontrole en Stripe PDF-doorsturing
- Admin-endpoints voor bedrijfsstatus, conceptfacturen, publiceren en geschilafhandeling

## 5. SEPA en betalingen

Stripe Checkout Setup Mode verzamelt het SEPA-mandaat provider-hosted. De eigen database bewaart alleen Stripe-ID’s en statusmetadata, nooit bankrekeninggegevens. Facturatie werkt met periodieke conceptfacturen en afzonderlijke immutable sales-lead- en kandidaatregels. Stripe-webhooks zijn ondertekend en idempotent en vullen zowel factuurstatus als betaalhistorie en mandaatstatistieken bij.

## 6. Authenticatie en autorisatie

Wachtwoorden zijn bcrypt-gehasht. Sessies gebruiken een korte, HttpOnly, Secure-in-productie, SameSite-cookie met JWT en database-backed `sessionVer` voor intrekking. Middleware scheidt admin- en bedrijfsroutes; iedere API doet daarnaast server-side rol- en tenantcontrole.

## 7. Benodigde environment variables

`DATABASE_URL`, `AUTH_JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `APP_URL` en `CRON_SECRET`; voor betalingen `STRIPE_SECRET_KEY` en `STRIPE_WEBHOOK_SECRET`; voor e-mail optioneel `RESEND_API_KEY` en `EMAIL_FROM`. Voor development seed kan `SEED_ADMIN_PASSWORD` worden gezet.

## 8. Externe configuratie

Koppel een productie-PostgreSQL-database, vul Vercel Environment Variables, configureer Stripe SEPA en registreer de webhook-URL. Configureer daarnaast een transactionele e-mailprovider voordat e-mailnotificaties worden geactiveerd.

## 9. Aanbevolen voor livegang

Laat privacy-, algemene en leadvoorwaarden juridisch controleren. Voer migrations eerst op staging uit, test echte Stripe testmandaten en mislukte incasso’s, voeg e-mailtemplates toe, configureer monitoring/log drains en voer een penetratie- en AVG-review uit met echte productie-instellingen.

## 10. Testen en CI

De Vitest-suite controleert sessie- en encryptiehelpers, CSRF en tenant-isolatie, source-scoped API-key/HMAC-authenticatie, replayclaims, structured consent, leadvalidatie, duplicate gedrag, matchingcapaciteit, outbox claim/retry en factuurconcepten. Route- en service-integraties mocken Prisma en Stripe aan de grens; productie-migrations en echte Stripe-flows blijven aparte releasechecks.

GitHub Actions voert op pushes naar `main`/`master` en op pull requests achtereenvolgens `npm ci`, Prisma-validatie en clientgeneratie, TypeScript typecheck, ESLint, Vitest en de Next.js build uit. CI gebruikt uitsluitend placeholder-waarden voor de verplichte serveromgeving.
