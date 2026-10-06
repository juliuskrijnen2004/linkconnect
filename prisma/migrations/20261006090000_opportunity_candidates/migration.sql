-- Additive opportunity layer. Legacy sales-lead tables remain intact for
-- publisher/API compatibility while candidates use the generic tables below.
CREATE TYPE "OpportunityType" AS ENUM ('SALES_LEAD', 'CANDIDATE');
CREATE TYPE "CandidateStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERVIEW', 'HIRED', 'REJECTED');

ALTER TABLE "Company" ADD COLUMN "candidateDeliveryActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PricingRule"
  ADD COLUMN "opportunityType" "OpportunityType" NOT NULL DEFAULT 'SALES_LEAD',
  ADD COLUMN "service" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "exclusivePriceCents" INTEGER,
  ADD COLUMN "sharedPriceCents" INTEGER,
  ADD COLUMN "maxBuyers" INTEGER;
CREATE INDEX "PricingRule_companyId_active_opportunityType_category_idx"
  ON "PricingRule"("companyId", "active", "opportunityType", "category");

ALTER TABLE "WeeklyCommitment" ADD COLUMN "opportunityType" "OpportunityType" NOT NULL DEFAULT 'SALES_LEAD';
DROP INDEX IF EXISTS "WeeklyCommitment_companyId_weekStart_key";
CREATE UNIQUE INDEX "WeeklyCommitment_companyId_weekStart_opportunityType_key"
  ON "WeeklyCommitment"("companyId", "weekStart", "opportunityType");
CREATE INDEX "WeeklyCommitment_companyId_opportunityType_weekStart_idx"
  ON "WeeklyCommitment"("companyId", "opportunityType", "weekStart");
ALTER TABLE "WeeklyCommitment" DROP CONSTRAINT IF EXISTS "WeeklyCommitment_minimumLeads_check";
ALTER TABLE "WeeklyCommitment" ADD CONSTRAINT "WeeklyCommitment_minimumLeads_by_type_check"
  CHECK (("opportunityType" = 'SALES_LEAD' AND "minimumLeads" >= 2)
      OR ("opportunityType" = 'CANDIDATE' AND "minimumLeads" >= 1));

CREATE TABLE "CandidatePreference" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "desiredRole" TEXT,
  "region" TEXT,
  "postalPrefixes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "maxDistanceKm" INTEGER,
  "minimumHours" INTEGER,
  "maximumHours" INTEGER,
  "minimumExperienceYears" INTEGER,
  "driversLicenseRequired" BOOLEAN NOT NULL DEFAULT false,
  "maxWeeklyCandidates" INTEGER,
  "minimumWeeklyCandidates" INTEGER DEFAULT 1,
  "exclusiveOnly" BOOLEAN NOT NULL DEFAULT false,
  "maxPriceCents" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidatePreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CandidatePreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CandidatePreference_companyId_active_category_idx" ON "CandidatePreference"("companyId", "active", "category");

CREATE TABLE "Opportunity" (
  "id" UUID NOT NULL,
  "type" "OpportunityType" NOT NULL,
  "sourceCompanyId" UUID NOT NULL,
  "leadSourceId" UUID,
  "sourceApiKeyId" UUID,
  "externalId" TEXT,
  "duplicateFingerprint" TEXT NOT NULL,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "category" TEXT NOT NULL,
  "service" TEXT,
  "sourceWebsite" TEXT,
  "city" TEXT,
  "region" TEXT,
  "postalCode" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "description" TEXT,
  "maxBuyersPerOpportunity" INTEGER NOT NULL DEFAULT 1,
  "exclusive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "consentAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Opportunity_sourceCompanyId_fkey" FOREIGN KEY ("sourceCompanyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Opportunity_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Opportunity_sourceApiKeyId_fkey" FOREIGN KEY ("sourceApiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Opportunity_leadSourceId_externalId_type_key" ON "Opportunity"("leadSourceId", "externalId", "type");
CREATE INDEX "Opportunity_type_status_category_postalCode_idx" ON "Opportunity"("type", "status", "category", "postalCode");
CREATE INDEX "Opportunity_sourceCompanyId_receivedAt_idx" ON "Opportunity"("sourceCompanyId", "receivedAt");
CREATE INDEX "Opportunity_leadSourceId_receivedAt_idx" ON "Opportunity"("leadSourceId", "receivedAt");

CREATE TABLE "OpportunityConsent" (
  "id" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "consentGiven" BOOLEAN NOT NULL,
  "consentTextVersion" TEXT NOT NULL,
  "consentTimestamp" TIMESTAMP(3) NOT NULL,
  "privacyPolicyVersion" TEXT NOT NULL,
  "sourceWebsite" TEXT NOT NULL,
  "ipHash" TEXT,
  "userAgentHash" TEXT,
  "proofHash" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpportunityConsent_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OpportunityConsent_opportunityId_key" ON "OpportunityConsent"("opportunityId");
CREATE INDEX "OpportunityConsent_consentTimestamp_idx" ON "OpportunityConsent"("consentTimestamp");

CREATE TABLE "CandidateProfile" (
  "id" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "desiredRole" TEXT NOT NULL,
  "jobCategory" TEXT NOT NULL,
  "desiredDistanceKm" INTEGER,
  "availableHours" INTEGER,
  "availableDays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "educationLevel" TEXT,
  "experienceYears" INTEGER,
  "driversLicense" BOOLEAN NOT NULL DEFAULT false,
  "availabilityDate" TIMESTAMP(3),
  "salaryIndication" INTEGER,
  "motivation" TEXT,
  "cvUrl" TEXT,
  "answers" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CandidateProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CandidateProfile_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CandidateProfile_opportunityId_key" ON "CandidateProfile"("opportunityId");
CREATE INDEX "CandidateProfile_jobCategory_desiredRole_idx" ON "CandidateProfile"("jobCategory", "desiredRole");

CREATE TABLE "OpportunityAllocation" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "opportunityId" UUID NOT NULL,
  "pricingRuleId" UUID,
  "status" "AllocationStatus" NOT NULL DEFAULT 'PENDING',
  "candidateStatus" "CandidateStatus" NOT NULL DEFAULT 'NEW',
  "internalNotes" TEXT,
  "viewedAt" TIMESTAMP(3),
  "score" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "priceSnapshot" JSONB NOT NULL,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpportunityAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OpportunityAllocation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OpportunityAllocation_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "OpportunityAllocation_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OpportunityAllocation_companyId_opportunityId_key" ON "OpportunityAllocation"("companyId", "opportunityId");
CREATE INDEX "OpportunityAllocation_companyId_status_allocatedAt_idx" ON "OpportunityAllocation"("companyId", "status", "allocatedAt");
CREATE INDEX "OpportunityAllocation_opportunityId_status_idx" ON "OpportunityAllocation"("opportunityId", "status");

ALTER TABLE "InvoiceLine" ALTER COLUMN "allocationId" DROP NOT NULL;
ALTER TABLE "InvoiceLine" ADD COLUMN "opportunityAllocationId" UUID;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_opportunityAllocationId_fkey"
  FOREIGN KEY ("opportunityAllocationId") REFERENCES "OpportunityAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "InvoiceLine_opportunityAllocationId_key" ON "InvoiceLine"("opportunityAllocationId");
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_one_allocation_check"
  CHECK (("allocationId" IS NOT NULL)::integer + ("opportunityAllocationId" IS NOT NULL)::integer = 1);

ALTER TABLE "AuditLog" ADD COLUMN "opportunityId" UUID;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
