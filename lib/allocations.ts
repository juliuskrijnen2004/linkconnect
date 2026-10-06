import { AllocationStatus, AuditActorType, LeadStatus, OpportunityType, Prisma } from "@prisma/client";

import { ConflictError, NotFoundError } from "@/lib/http";
import { COMPANY_EMAIL_OUTBOX_EVENT, notificationEvents } from "@/lib/notifications";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";

export type AllocationCandidate = {
  companyId: string;
  pricingRuleId: string;
  score: number;
  expiresAt?: Date;
};

const deliveryStatuses = [
  AllocationStatus.PENDING,
  AllocationStatus.ACCEPTED,
  AllocationStatus.INVOICED,
  AllocationStatus.DISPUTED,
];

function weekStart(value = new Date()) {
  const start = new Date(value);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return start;
}

async function lockLead(tx: Prisma.TransactionClient, leadId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Lead" WHERE "id" = ${leadId}::uuid FOR UPDATE`;
  return tx.lead.findUnique({ where: { id: leadId } });
}

async function createAllocation(
  tx: Prisma.TransactionClient,
  lead: { id: string; category: string; maxBuyersPerLead: number },
  candidate: AllocationCandidate,
) {
  const existing = await tx.allocation.findUnique({
    where: { companyId_leadId: { companyId: candidate.companyId, leadId: lead.id } },
    select: { id: true },
  });
  if (existing) return null;

  // A company lock makes the weekly delivery limit atomic across different leads.
  await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${candidate.companyId}::uuid FOR UPDATE`;

  const [rule, company, activeMandate, preferences, deliveredThisWeek] = await Promise.all([
    tx.pricingRule.findFirst({
      where: { id: candidate.pricingRuleId, companyId: candidate.companyId, active: true, category: lead.category },
    }),
    tx.company.findUnique({
      where: { id: candidate.companyId },
      select: { id: true, status: true, leadDeliveryActive: true, minimumWeeklyLeads: true },
    }),
    tx.sepaMandate.findFirst({
      where: { companyId: candidate.companyId, status: "ACTIVE" },
      select: { id: true },
    }),
    tx.companyLeadPreference.findMany({
      where: { companyId: candidate.companyId, active: true, category: { name: lead.category } },
      select: { maxWeeklyLeads: true },
    }),
    tx.allocation.count({
      where: {
        companyId: candidate.companyId,
        allocatedAt: { gte: weekStart() },
        status: { in: deliveryStatuses },
      },
    }),
  ]);
  if (!rule) throw new ConflictError("Active pricing rule does not match this lead");
  if (!company || company.status !== "ACTIVE" || !company.leadDeliveryActive || !activeMandate) {
    throw new ConflictError("Target company is not eligible for lead delivery");
  }
  const weeklyLimit = preferences.reduce<number | null>((limit, preference) => {
    if (preference.maxWeeklyLeads == null) return limit;
    return limit == null ? preference.maxWeeklyLeads : Math.min(limit, preference.maxWeeklyLeads);
  }, null);
  if (weeklyLimit != null && deliveredThisWeek >= weeklyLimit) {
    throw new ConflictError("Target company has reached its weekly lead limit");
  }

  const allocation = await tx.allocation.create({
    data: {
      companyId: candidate.companyId,
      leadId: lead.id,
      pricingRuleId: rule.id,
      score: candidate.score,
      priceCents: rule.priceCents,
      currency: rule.currency,
      priceSnapshot: {
        pricingRuleId: rule.id,
        pricingRuleName: rule.name,
        category: rule.category,
        postalPrefixes: rule.postalPrefixes,
        priceCents: rule.priceCents,
        currency: rule.currency,
        capturedAt: new Date().toISOString(),
      },
      expiresAt: candidate.expiresAt,
      status: AllocationStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });
  const currentWeek = weekStart();
  await tx.weeklyCommitment.upsert({
    where: { companyId_weekStart_opportunityType: { companyId: candidate.companyId, weekStart: currentWeek, opportunityType: OpportunityType.SALES_LEAD } },
    create: {
      companyId: candidate.companyId,
      weekStart: currentWeek,
      opportunityType: OpportunityType.SALES_LEAD,
      minimumLeads: company.minimumWeeklyLeads,
      deliveredLeads: 1,
      billableLeads: 1,
      shortfall: Math.max(company.minimumWeeklyLeads - 1, 0),
    },
    // Keep the stored shortfall non-negative until the SQL clamp below recomputes it.
    update: { deliveredLeads: { increment: 1 }, billableLeads: { increment: 1 } },
  });
  await tx.$executeRaw`
    UPDATE "WeeklyCommitment"
    SET "shortfall" = GREATEST("minimumLeads" - "deliveredLeads", 0)
    WHERE "companyId" = ${candidate.companyId}::uuid AND "weekStart" = ${currentWeek} AND "opportunityType" = 'SALES_LEAD'::"OpportunityType"
  `;
  await tx.auditLog.create({
    data: {
      companyId: candidate.companyId,
      actorType: AuditActorType.SYSTEM,
      action: "lead.allocated",
      entityType: "Allocation",
      entityId: allocation.id,
      leadId: lead.id,
      allocationId: allocation.id,
      metadata: { score: candidate.score, priceCents: rule.priceCents, currency: rule.currency },
    },
  });
  await enqueueOutboxEvent(tx, {
    dedupeKey: `notification:new-lead:${allocation.id}`,
    eventType: COMPANY_EMAIL_OUTBOX_EVENT,
    aggregateType: "Allocation",
    aggregateId: allocation.id,
    companyId: allocation.companyId,
    payload: {
      eventType: notificationEvents.newLead,
      subject: "Nieuwe lead in LinkConnect",
      text: "Er staat een nieuwe klantaanvraag voor je klaar in het beveiligde LinkConnect-dashboard.",
    },
  });
  return allocation;
}

// A row lock serializes allocation decisions for one lead across all workers.
export async function allocateLeadCandidates(leadId: string, candidates: AllocationCandidate[]) {
  return prisma.$transaction(async (tx) => {
    const lead = await lockLead(tx, leadId);
    if (!lead) throw new NotFoundError("Lead not found");
    const existing = await tx.allocation.findMany({
      where: { leadId, status: { in: deliveryStatuses } },
      select: { companyId: true },
    });
    const allocatedCompanyIds = new Set(existing.map((allocation) => allocation.companyId));
    let slots = Math.max(0, lead.maxBuyersPerLead - existing.length);
    const allocations = [];
    for (const candidate of candidates) {
      if (slots === 0) break;
      if (allocatedCompanyIds.has(candidate.companyId)) continue;
      let allocation = null;
      try {
        allocation = await createAllocation(tx, lead, candidate);
      } catch (error) {
        // Automatic matching may race with a pricing or account-state change.
        // Skip that stale candidate and continue with the next eligible company.
        if (!(error instanceof ConflictError)) throw error;
      }
      if (allocation) {
        allocations.push(allocation);
        allocatedCompanyIds.add(candidate.companyId);
        slots -= 1;
      }
    }
    if (allocations.length > 0) {
      await tx.lead.update({ where: { id: lead.id }, data: { status: LeadStatus.ALLOCATED } });
    }
    return allocations;
  });
}

export async function allocateLead(input: AllocationCandidate & { leadId: string }) {
  const allocations = await allocateLeadCandidates(input.leadId, [input]);
  const allocation = allocations[0];
  if (allocation) return allocation;
  const existing = await prisma.allocation.findUnique({
    where: { companyId_leadId: { companyId: input.companyId, leadId: input.leadId } },
  });
  if (existing) return existing;
  throw new ConflictError("Lead has no remaining buyer capacity");
}

export async function reassignAllocation(input: {
  allocationId: string;
  targetCompanyId: string;
  targetPricingRuleId: string;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const sourceLead = await tx.allocation.findUnique({
      where: { id: input.allocationId },
      select: { leadId: true },
    });
    if (!sourceLead) throw new NotFoundError("Allocation not found");
    await lockLead(tx, sourceLead.leadId);
    const source = await tx.allocation.findUnique({
      where: { id: input.allocationId },
      include: { lead: true, invoiceLine: { select: { id: true } } },
    });
    if (!source) throw new NotFoundError("Allocation not found");
    if (!([AllocationStatus.PENDING, AllocationStatus.ACCEPTED] as AllocationStatus[]).includes(source.status) || source.invoiceLine) {
      throw new ConflictError("Only uninvoiced allocations can be reassigned");
    }
    if (source.companyId === input.targetCompanyId) throw new ConflictError("Target company already owns this allocation");
    const targetExists = await tx.allocation.findUnique({
      where: { companyId_leadId: { companyId: input.targetCompanyId, leadId: source.leadId } },
      select: { id: true },
    });
    if (targetExists) throw new ConflictError("Target company already has this lead");

    await tx.allocation.update({ where: { id: source.id }, data: { status: AllocationStatus.REJECTED, companyStatus: "LOST" } });
    await tx.weeklyCommitment.updateMany({
      where: { companyId: source.companyId, weekStart: weekStart(source.allocatedAt), deliveredLeads: { gt: 0 }, billableLeads: { gt: 0 } },
      data: { deliveredLeads: { decrement: 1 }, billableLeads: { decrement: 1 }, shortfall: { increment: 1 } },
    });
    await tx.$executeRaw`
      UPDATE "WeeklyCommitment"
      SET "shortfall" = GREATEST("minimumLeads" - "deliveredLeads", 0)
      WHERE "companyId" = ${source.companyId}::uuid AND "weekStart" = ${weekStart(source.allocatedAt)}
    `;
    const allocation = await createAllocation(tx, source.lead, {
      companyId: input.targetCompanyId,
      pricingRuleId: input.targetPricingRuleId,
      score: source.score,
      expiresAt: source.expiresAt ?? undefined,
    });
    if (!allocation) throw new ConflictError("Target allocation could not be created");
    await tx.auditLog.create({
      data: {
        companyId: source.companyId,
        actorUserId: input.actorUserId,
        actorType: AuditActorType.USER,
        action: "allocation.reassigned",
        entityType: "Allocation",
        entityId: source.id,
        leadId: source.leadId,
        allocationId: source.id,
        metadata: { replacementAllocationId: allocation.id, targetCompanyId: input.targetCompanyId },
      },
    });
    return allocation;
  });
}

export async function acceptAllocation(companyId: string, allocationId: string) {
  const allocation = await prisma.allocation.updateMany({
    where: { id: allocationId, companyId, status: AllocationStatus.PENDING },
    data: { status: AllocationStatus.ACCEPTED, acceptedAt: new Date() },
  });
  if (allocation.count !== 1) throw new ConflictError("Allocation is not available for acceptance");
}
