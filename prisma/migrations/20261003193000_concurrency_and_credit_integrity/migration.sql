ALTER TABLE "Invoice" ADD COLUMN "creditedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_creditedCents_check"
  CHECK ("creditedCents" >= 0 AND "creditedCents" <= "totalCents");

CREATE UNIQUE INDEX "Dispute_one_open_per_allocation_key"
  ON "Dispute"("allocationId")
  WHERE "status" IN ('OPEN', 'UNDER_REVIEW');
