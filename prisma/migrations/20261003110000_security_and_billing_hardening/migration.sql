-- Shared rate-limit state and one draft/final invoice per company period.
CREATE TABLE "RateLimitEntry" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "RateLimitEntry_resetAt_idx" ON "RateLimitEntry"("resetAt");

-- Keep the database invariant aligned with onboarding, dashboard and admin APIs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Company" WHERE "minimumWeeklyLeads" < 2)
     OR EXISTS (SELECT 1 FROM "WeeklyCommitment" WHERE "minimumLeads" < 2 OR "shortfall" < 0) THEN
    RAISE EXCEPTION 'Cannot add weekly-delivery constraints: invalid historical minimum or shortfall exists';
  END IF;
END $$;

ALTER TABLE "Company"
  ADD CONSTRAINT "Company_minimumWeeklyLeads_check" CHECK ("minimumWeeklyLeads" >= 2);
ALTER TABLE "WeeklyCommitment"
  ADD CONSTRAINT "WeeklyCommitment_minimumLeads_check" CHECK ("minimumLeads" >= 2),
  ADD CONSTRAINT "WeeklyCommitment_shortfall_check" CHECK ("shortfall" >= 0);

-- Do not silently choose or delete a historical invoice if earlier deployments
-- produced duplicate periods. Reconcile those records before applying the
-- invariant, then rerun this migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Invoice"
    GROUP BY "companyId", "periodStart", "periodEnd"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique invoice-period invariant: duplicate invoice periods exist';
  END IF;
END $$;

CREATE UNIQUE INDEX "Invoice_companyId_periodStart_periodEnd_key"
  ON "Invoice"("companyId", "periodStart", "periodEnd");
