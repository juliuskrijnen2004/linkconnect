-- Reviewer hardening: recipient distribution is source-owned and every
-- production leads:write credential requires a signed request.

ALTER TABLE "LeadSource"
  ADD COLUMN "maxRecipientsPerLead" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "LeadSource"
  ADD CONSTRAINT "LeadSource_maxRecipientsPerLead_check"
  CHECK ("maxRecipientsPerLead" BETWEEN 1 AND 20);

ALTER TABLE "ApiKey"
  ALTER COLUMN "hmacRequired" SET DEFAULT true;

-- Existing write credentials without a stored HMAC secret will fail closed and
-- must be reissued. This deliberately prevents a legacy key from bypassing
-- the production signed-ingest requirement.
UPDATE "ApiKey"
SET "hmacRequired" = true
WHERE "scopes" @> ARRAY['leads:write']::TEXT[];
