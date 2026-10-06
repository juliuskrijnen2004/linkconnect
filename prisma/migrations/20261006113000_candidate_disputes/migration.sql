-- Candidate allocations use the same credit and dispute lifecycle as sales
-- leads. This is additive: existing lead disputes retain allocationId.
ALTER TABLE "Dispute" ALTER COLUMN "allocationId" DROP NOT NULL;
ALTER TABLE "Dispute" ADD COLUMN "opportunityAllocationId" UUID;

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_opportunityAllocationId_fkey"
  FOREIGN KEY ("opportunityAllocationId") REFERENCES "OpportunityAllocation"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Dispute_opportunityAllocationId_idx"
  ON "Dispute"("opportunityAllocationId");

ALTER TABLE "Dispute"
  ADD CONSTRAINT "Dispute_one_allocation_check"
  CHECK (("allocationId" IS NOT NULL)::integer + ("opportunityAllocationId" IS NOT NULL)::integer = 1);
