CREATE TYPE "CompanyStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'REJECTED');
CREATE TYPE "MandateStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'FAILED', 'REVOKED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE "CompanyLeadStatus" AS ENUM ('NEW', 'VIEWED', 'CONTACTED', 'APPOINTMENT', 'WON', 'LOST', 'DISPUTED');

ALTER TABLE "Company"
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "kvkNumber" TEXT,
  ADD COLUMN "vatNumber" TEXT,
  ADD COLUMN "status" "CompanyStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "leadDeliveryActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "minimumWeeklyLeads" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "pausedAt" TIMESTAMP(3);

ALTER TABLE "Lead"
  ADD COLUMN "service" TEXT,
  ADD COLUMN "sourceWebsite" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "maxBuyersPerLead" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "exclusive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Allocation"
  ADD COLUMN "companyStatus" "CompanyLeadStatus" NOT NULL DEFAULT 'NEW',
  ADD COLUMN "internalNotes" TEXT,
  ADD COLUMN "viewedAt" TIMESTAMP(3);

CREATE TABLE "LeadCategory" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "defaultPriceCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadCategory_slug_key" ON "LeadCategory"("slug");

CREATE TABLE "Service" (
  "id" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Service_categoryId_slug_key" ON "Service"("categoryId", "slug");

CREATE TABLE "CompanyLeadPreference" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "categoryId" UUID NOT NULL,
  "serviceId" UUID,
  "preferenceKey" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "maxWeeklyLeads" INTEGER,
  "extraFilters" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyLeadPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyLeadPreference_companyId_preferenceKey_key" ON "CompanyLeadPreference"("companyId", "preferenceKey");
CREATE INDEX "CompanyLeadPreference_companyId_active_idx" ON "CompanyLeadPreference"("companyId", "active");

CREATE TABLE "CompanyRegion" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "region" TEXT NOT NULL,
  "postalPrefixes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "radiusKm" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyRegion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyRegion_companyId_region_key" ON "CompanyRegion"("companyId", "region");

CREATE TABLE "CompanyAgreement" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL,
  "ipHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyAgreement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CompanyAgreement_companyId_type_version_key" ON "CompanyAgreement"("companyId", "type", "version");

CREATE TABLE "SepaMandate" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerMandateId" TEXT,
  "status" "MandateStatus" NOT NULL DEFAULT 'PENDING',
  "lastSuccessfulPaymentAt" TIMESTAMP(3),
  "failedPaymentCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SepaMandate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SepaMandate_providerMandateId_key" ON "SepaMandate"("providerMandateId");
CREATE INDEX "SepaMandate_companyId_status_idx" ON "SepaMandate"("companyId", "status");
CREATE UNIQUE INDEX "SepaMandate_companyId_provider_key" ON "SepaMandate"("companyId", "provider");

CREATE TABLE "Payment" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "invoiceId" UUID,
  "providerPaymentId" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amountCents" INTEGER NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
  "failureCode" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");
CREATE INDEX "Payment_companyId_status_createdAt_idx" ON "Payment"("companyId", "status", "createdAt");

CREATE TABLE "NotificationPreference" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "sms" BOOLEAN NOT NULL DEFAULT false,
  "whatsapp" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationPreference_companyId_eventType_key" ON "NotificationPreference"("companyId", "eventType");

CREATE TABLE "WeeklyCommitment" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "minimumLeads" INTEGER NOT NULL,
  "deliveredLeads" INTEGER NOT NULL DEFAULT 0,
  "billableLeads" INTEGER NOT NULL DEFAULT 0,
  "shortfall" INTEGER NOT NULL DEFAULT 0,
  "exceptionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyCommitment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WeeklyCommitment_companyId_weekStart_key" ON "WeeklyCommitment"("companyId", "weekStart");

ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LeadCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyLeadPreference" ADD CONSTRAINT "CompanyLeadPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyLeadPreference" ADD CONSTRAINT "CompanyLeadPreference_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LeadCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyLeadPreference" ADD CONSTRAINT "CompanyLeadPreference_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompanyRegion" ADD CONSTRAINT "CompanyRegion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyAgreement" ADD CONSTRAINT "CompanyAgreement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SepaMandate" ADD CONSTRAINT "SepaMandate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyCommitment" ADD CONSTRAINT "WeeklyCommitment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
