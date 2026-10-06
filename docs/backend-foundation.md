# LinkConnect Backend Foundation

This foundation converts LinkConnect to a Next.js App Router B2B lead platform with a new marketing site, protected company dashboard, admin area and typed backend services. It uses Next.js, Prisma, Zod, JOSE, bcrypt and Stripe. Use a Node.js runtime for routes needing Node crypto or Stripe.

## Setup

1. Copy `.env.example` to `.env.local` and replace every placeholder. Keep `.env.local` outside version control.
2. Create a PostgreSQL database and run `npx prisma generate` followed by `npx prisma migrate deploy`.
3. For a local demo only, run `npx prisma db seed`. Set `SEED_ADMIN_PASSWORD` first; otherwise the seed prints its explicit development fallback password. The HMAC API credentials are printed only on their initial creation.
4. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` through the deployment secret manager. Do not put any Stripe, API-key, JWT, encryption, or database credential in client-side variables.

`DATA_ENCRYPTION_KEY` must be a base64-encoded 32-byte key. It encrypts HMAC secrets stored in the database using AES-256-GCM. API keys themselves are stored only as SHA-256 hashes. Rotate an API key instead of attempting to retrieve it.

## Test And CI Contract

The repository uses Vitest for deterministic unit and mocked integration tests. The suite covers session-token validation, encryption and same-origin guards, tenant scoping, rate limits, API-key/HMAC authentication, lead payload validation, lead-ingest allocation limits, and invoice-draft invariants. Tests do not connect to PostgreSQL or Stripe and do not need real credentials.

Run the local quality chain with:

```text
npm ci
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
```

`.github/workflows/ci.yml` runs this chain for pushes to `main`/`master` and for pull requests. CI uses non-secret placeholder environment values only; it never runs migrations, seed data, Stripe calls, or production workflows.

The npm test scripts explicitly use Vitest's `runner` config loader. This keeps the config under the owned `tests/` tree and avoids a Windows/OneDrive path-resolution issue in esbuild's default config bundler; the same command is portable to the Linux CI runner.

## Identity And Tenancy

- `POST /api/auth/login` issues an eight-hour, `HttpOnly`, `Secure` in production, `SameSite=Lax` JWT cookie named `lc_session`.
- Protected route handlers call `requireSession`/`requireCompanySession`, which verify the JWT and re-check the user's role, company, and `sessionVer` in PostgreSQL. Increment `sessionVer` to revoke every existing session for a user.
- `middleware.ts` rejects missing or invalid JWTs before `/dashboard`, `/admin`, onboarding and protected account APIs; it intentionally performs no database work. Route handlers remain the final authorization boundary and re-check the database-backed session version.
- A `COMPANY` user can only form Prisma scope using their own `companyId`. An `ADMIN` can optionally scope to a company. Never accept a client-provided company ID without passing it through `tenantScope` or `requireTenantCompanyId`.

## Lead Sources And Ingest

`POST /api/leads` is a server-to-server endpoint; it never accepts a browser session as a substitute for an ingest credential.

Every production publisher gets its own active `LeadSource` and API key. The key is bound to that source, must include `leads:write`, and can be restricted by source domain, category slugs, and services. Legacy keys without `leadSourceId` are retained by the migration but cannot ingest until explicitly provisioned.

Required headers:

```text
x-api-key: lc_live_...
content-type: application/json
```

The endpoint accepts a maximum one-megabyte JSON payload. Structured `consent` is required for new API leads and records capture time, version, source, optional proof hashes, marketing choice, and redacted metadata. Email or phone is required. `leadSourceId + externalId` is idempotent: a fresh retry returns the existing lead and allocations without a new outbox event, while the exact same signed request is rejected as a replay.

For keys created with `hmacRequired: true`, additionally send a Unix timestamp (seconds or milliseconds) and a lower-case hex signature:

```text
x-linkconnect-timestamp: 1760000000
x-linkconnect-signature: <hex(HMAC-SHA256(secret, timestamp + "." + rawBody))>
```

Sign the exact raw UTF-8 request body and send within five minutes. Signature comparison is constant-time. The HMAC secret is shown only at key creation; it is encrypted at rest and cannot be reconstructed from the API key hash.

Lead, consent, audit and a PII-minimal outbox event are written in one transaction. Matching is asynchronous: Vercel Cron authenticates with `CRON_SECRET`, claims events using `FOR UPDATE SKIP LOCKED`, recovers stale leases, applies bounded exponential backoff, and completes `lead.ingested` only after matching/allocation succeeds. Allocation locks the lead row and company row, so multiple workers cannot exceed buyer capacity or weekly limits.

Admin-created leads intentionally use manual allocation. They require an active `LeadSource`, create structured admin consent evidence and an audit entry, and do not enqueue an automatic matching event.

## Opportunities, Matching, Allocation, Billing, And Disputes

`lib/matching.ts` resolves active `PricingRule` records by category and postcode prefix. `lib/allocations.ts` creates a unique allocation per company/lead and copies the applied rule, amount, currency, and timestamp into `priceSnapshot`. That snapshot is immutable evidence for the later invoice and dispute flow.

Sales leads remain on the legacy `Lead`/`Allocation` compatibility model. Recruitment candidates use `Opportunity(type=CANDIDATE)`, `CandidateProfile`, `OpportunityConsent`, and `OpportunityAllocation`. `POST /api/candidates` creates all of those source facts transactionally with a PII-minimal `candidate.ingested` outbox event. `lib/candidate-matching.ts` checks active candidate delivery, active mandate, role/category, region or postcode prefix, hours, experience, licence, weekly caps, sharing/exclusivity, and candidate price cap. `lib/candidate-allocations.ts` locks the opportunity and target company before allocation, records the immutable price snapshot, and keeps a separate `WeeklyCommitment(opportunityType=CANDIDATE)`.

`createInvoiceDraft` selects only accepted, uninvoiced allocations for one tenant and period, creates corresponding immutable invoice lines, then marks the allocations invoiced in one transaction. `publishInvoiceToStripe` creates a Stripe invoice using `sepa_debit`; Stripe alone owns mandate and bank-account data. The local schema stores only Stripe customer/invoice IDs and financial totals.

Configure Stripe to send its invoice lifecycle events to `POST /api/webhooks/stripe`. The endpoint verifies Stripe's raw-body signature and records the Stripe event ID transactionally, making retries idempotent. `POST /api/allocations/:allocationId/disputes` opens a company-scoped dispute, transitions its allocation to `DISPUTED`, and writes an audit event.

Audit logs intentionally store operational references and redacted metadata only. Do not add lead contact details, API keys, HMAC data, passwords, Stripe payloads, mandates, or bank data to audit metadata.

## Migration

Checked-in migrations, in order:

- `20261002090000_backend_foundation`
- `20261002150000_platform_expansion`
- `20261003110000_security_and_billing_hardening`
- `20261003130000_ingest_outbox_hardening`
- `20261003193000_concurrency_and_credit_integrity`
- `20261003200000_ingest_review_hardening`
- `20261006090000_opportunity_candidates`

The ingest migration is additive for legacy rows: existing leads may retain a null `leadSourceId`, while all new external ingest requires a source. Existing keys receive a scope default but remain unusable for ingest until bound to a source. Validate and back up a populated database before `prisma migrate deploy`; never use reset or the development seed in production.
