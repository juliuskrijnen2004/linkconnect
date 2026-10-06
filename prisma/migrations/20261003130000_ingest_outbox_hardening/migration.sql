-- Ingest hardening: scoped publisher credentials, structured consent evidence,
-- transactional replay claims and a durable outbox.

CREATE TYPE "LeadSourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REVOKED');

CREATE TABLE "LeadSource" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "domain" TEXT,
  "status" "LeadSourceStatus" NOT NULL DEFAULT 'ACTIVE',
  "allowedCategorySlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedServices" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "LeadSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadSource_companyId_slug_key" ON "LeadSource"("companyId", "slug");
CREATE INDEX "LeadSource_status_domain_idx" ON "LeadSource"("status", "domain");

ALTER TABLE "ApiKey"
  ADD COLUMN "leadSourceId" UUID,
  ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY['leads:write']::TEXT[];
ALTER TABLE "Lead"
  ADD COLUMN "leadSourceId" UUID;
CREATE INDEX "ApiKey_leadSourceId_status_idx" ON "ApiKey"("leadSourceId", "status");
CREATE INDEX "Lead_leadSourceId_receivedAt_idx" ON "Lead"("leadSourceId", "receivedAt");

CREATE TABLE "LeadConsent" (
  "id" UUID NOT NULL,
  "leadId" UUID NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "version" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "proofHash" TEXT,
  "marketingAllowed" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadConsent_leadId_key" ON "LeadConsent"("leadId");
CREATE INDEX "LeadConsent_capturedAt_idx" ON "LeadConsent"("capturedAt");

CREATE TABLE "IngestReplay" (
  "id" UUID NOT NULL,
  "apiKeyId" UUID NOT NULL,
  "replayKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngestReplay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IngestReplay_apiKeyId_replayKey_key"
  ON "IngestReplay"("apiKeyId", "replayKey");
CREATE INDEX "IngestReplay_expiresAt_idx" ON "IngestReplay"("expiresAt");

CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "OutboxEvent" (
  "id" UUID NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" UUID NOT NULL,
  "companyId" UUID,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutboxEvent_dedupeKey_key" ON "OutboxEvent"("dedupeKey");
CREATE INDEX "OutboxEvent_status_availableAt_idx"
  ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_aggregateType_aggregateId_createdAt_idx"
  ON "OutboxEvent"("aggregateType", "aggregateId", "createdAt");

ALTER TABLE "LeadConsent"
  ADD CONSTRAINT "LeadConsent_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey"
  ADD CONSTRAINT "ApiKey_leadSourceId_fkey"
  FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_leadSourceId_fkey"
  FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IngestReplay"
  ADD CONSTRAINT "IngestReplay_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboxEvent"
  ADD CONSTRAINT "OutboxEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadSource"
  ADD CONSTRAINT "LeadSource_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Publisher identity, rather than the owning company, defines an external ID.
-- Existing leads have a nullable source during the transition; PostgreSQL
-- permits multiple NULLs while enforcing uniqueness for scoped ingest keys.
DROP INDEX IF EXISTS "Lead_fingerprint_key";
DROP INDEX IF EXISTS "Lead_sourceCompanyId_externalId_key";
CREATE UNIQUE INDEX "Lead_leadSourceId_externalId_key"
  ON "Lead"("leadSourceId", "externalId");
