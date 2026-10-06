# LinkConnect

LinkConnect is a Next.js App Router opportunity-distribution platform. Companies receive matched sales leads and recruitment candidates, manage their delivery in separate dashboard views, and are invoiced per accepted opportunity. PostgreSQL is accessed through Prisma; Stripe handles SEPA mandate and invoice payment details.

## Requirements

- Node.js 22 or newer
- npm
- PostgreSQL 14 or newer for a running local application
- Stripe test credentials only when exercising payment and webhook flows

The automated test suite does not require PostgreSQL, Stripe, or any real credential. It uses Vitest and mocks the database and Stripe boundaries.

## Local setup

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env.local` and replace the placeholders. Never commit `.env`, `.env.local`, Stripe credentials, API keys, passwords, JWT secrets, or encryption keys.

3. Generate the Prisma client and apply migrations to a local PostgreSQL database:

   ```bash
   npm run db:generate
   npm run db:validate
   npm run db:migrate
   ```

4. Optionally seed a local demo database. Set `SEED_ADMIN_PASSWORD` first if a known admin password is needed:

   ```bash
   npm run db:seed
   ```

   Seeding is blocked when `NODE_ENV=production`. The seed prints generated API credentials only at their initial creation; store them securely.

5. Start the development server:

   ```bash
   npm run dev
   ```

   The application is available at `http://localhost:3000`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_JWT_SECRET` | Yes | At least 32 characters for session signing |
| `DATA_ENCRYPTION_KEY` | Yes | Base64-encoded 32-byte AES-256-GCM key |
| `APP_URL` | No | Public origin used for provider return URLs |
| `CRON_SECRET` | Production worker | At least 32 random characters for the authenticated outbox worker |
| `STRIPE_SECRET_KEY` | Payment flows | Server-only Stripe secret key, normally `sk_test_...` in development |
| `STRIPE_WEBHOOK_SECRET` | Webhooks | Server-only Stripe signing secret |
| `RESEND_API_KEY` | Email | Optional server-only Resend API key |
| `EMAIL_FROM` | Email | Verified transactional sender address |
| `SEED_ADMIN_PASSWORD` | Seed only | Optional local seed admin password |

`DATA_ENCRYPTION_KEY` protects stored HMAC secrets. API keys themselves are stored as SHA-256 hashes and cannot be recovered after creation. Rotate a key when it is lost.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Generate Prisma client and build Next.js |
| `npm run start` | Run the production build |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Run ESLint over the repository |
| `npm test` | Run Vitest once in CI mode |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Apply checked-in migrations |
| `npm run db:seed` | Seed a local development database |

## Architecture

- `app/` contains marketing pages, authenticated dashboards, admin pages, and App Router route handlers.
- `lib/` contains authentication, tenant authorization, lead ingestion, matching, allocations, billing, disputes, Stripe, and security helpers.
- `prisma/` contains the schema, migrations, and development seed.
- `components/` contains shared page and dashboard UI.
- `tests/` contains pure unit tests and mocked route/service integration tests.
- `.github/workflows/ci.yml` runs install, Prisma validation and generation, typecheck, lint, tests, and build on pushes and pull requests.

## Security boundaries

Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Route handlers re-check the database-backed session version and role after middleware. Company sessions are scoped to their own `companyId`; admins must explicitly scope tenant operations where required.

Lead ingestion is server-to-server only. Each credential belongs to one active `LeadSource`, needs the `leads:write` scope, and is checked against that source's domain, category, and service policy. HMAC-enabled keys sign the exact raw UTF-8 body with a five-minute timestamp window; signed request replays are claimed transactionally. The `leadSourceId`/external lead ID pair is idempotent.

New API leads, structured consent evidence, their audit record, and a PII-minimal `lead.ingested` outbox event are committed in one transaction. `POST /api/leads` never matches inline. Vercel Cron calls the authenticated `/api/internal/outbox` worker, which claims events with `FOR UPDATE SKIP LOCKED`, retries with backoff, and invokes matching/allocation idempotently.

Stripe webhooks are verified against the raw body and recorded idempotently. Stripe owns mandate and bank-account data; LinkConnect stores provider IDs, status, and financial totals only. Audit metadata must remain redacted and must not contain contact details, credentials, passwords, raw Stripe payloads, or bank data.

## HTTP surface

Public marketing pages are served from the route groups under `app/(marketing)`. The main authenticated flows are:

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `POST /api/onboarding` and `/api/billing/sepa-setup`
- `POST /api/leads` for backwards-compatible sales-lead ingest and `POST /api/candidates` for consented candidate ingest
- `GET|POST /api/internal/outbox` for authenticated Vercel Cron processing
- `GET /api/allocations` and `POST /api/allocations/:allocationId/disputes`
- `POST /api/leads/:id/status`
- `POST /api/company/profile`, `/preferences`, and `/settings`
- `GET /api/me` and `POST /api/support`
- `POST /api/webhooks/stripe`
- `GET /api/invoices/:id/download`
- Admin routes for company status, invoice drafting and publishing, and dispute resolution

The detailed backend contract is documented in [`docs/backend-foundation.md`](docs/backend-foundation.md). The delivery record and operational follow-ups are in [`docs/opleverrapport.md`](docs/opleverrapport.md).

## Lead ingest example

```bash
curl -X POST http://localhost:3000/api/leads \
  -H 'content-type: application/json' \
  -H 'x-api-key: lc_live_REPLACE_WITH_A_CREATED_KEY' \
  -d '{
    "sourceWebsite": "https://source.example",
    "externalLeadId": "lead-123",
    "category": "Zonnepanelen",
    "service": "Advies",
    "customerName": "Ada Lovelace",
    "email": "ada@example.com",
    "postcode": "1012 AB",
    "city": "Amsterdam",
    "region": "Noord-Holland",
    "description": "Klant zoekt advies.",
    "createdAt": "2026-10-03T09:00:00.000Z",
    "consent": {
      "accepted": true,
      "capturedAt": "2026-10-03T08:59:00.000Z",
      "version": "lead-form-v1",
      "source": "source.example",
      "marketingAllowed": false,
      "metadata": {}
    }
  }'
```

HMAC-required keys also need `x-linkconnect-timestamp` and a lowercase hexadecimal `x-linkconnect-signature` for `HMAC-SHA256(secret, timestamp + "." + rawBody)`. Use the exact body bytes that are sent.

Admin-created leads are deliberately manual-allocation records. They require an active `LeadSource`, store `LeadConsent` and audit evidence, but do not enqueue `lead.ingested`; an admin assigns them through the explicit allocation endpoint.

## Candidates and opportunities

Existing `Lead` and `Allocation` records remain the compatibility path for sales-lead publishers. New candidate traffic uses the generic `Opportunity` and `OpportunityAllocation` models with `type: CANDIDATE`; it carries a separately scoped candidate profile and explicit consent proof. Candidate ingestion requires a source-scoped `candidates:write` key and uses the same HMAC, replay protection, duplicate handling, audit trail, and transaction outbox pattern as sales leads.

`POST /api/candidates` accepts an `externalCandidateId`, contact method, location, `jobCategory`, `desiredRole`, availability, experience, driving licence, consent proof, and optional CV URL. Never submit BSN, medical details, ID copies, or other special-category data. Candidate matching requires an active company, active SEPA mandate, candidate delivery setting, matching candidate preference, region/postcode match, hours/experience/licence constraints, weekly cap, and pricing rule. Each allocation snapshots its price before billing. `maxDistanceKm` is retained as a preference field; geographic-radius matching must only be enabled after company coordinates are introduced.

## Verification and deployment

Run the same local quality chain used by CI:

```bash
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
```

The normal release path is Git `main` to GitHub Actions, then the existing Vercel project. Apply checked-in migrations with `prisma migrate deploy`; never run `migrate reset` or the development seed in production. Configure Vercel Cron, Stripe test-mode SEPA/webhooks, transactional email, monitoring, database backups, and legal/privacy review before commercial traffic.
