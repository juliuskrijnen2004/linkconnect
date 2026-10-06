import { AllocationStatus, AuditActorType, CandidateStatus, OpportunityType, Prisma } from "@prisma/client";
import { CandidateMatch } from "@/lib/candidate-matching";
import { ConflictError, NotFoundError } from "@/lib/http";
import { COMPANY_EMAIL_OUTBOX_EVENT, notificationEvents } from "@/lib/notifications";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
const active = [AllocationStatus.PENDING, AllocationStatus.ACCEPTED, AllocationStatus.INVOICED, AllocationStatus.DISPUTED];
function weekStart() { const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return date; }
async function lock(tx: Prisma.TransactionClient, id: string) { await tx.$queryRaw`SELECT "id" FROM "Opportunity" WHERE "id" = ${id}::uuid FOR UPDATE`; return tx.opportunity.findUnique({ where: { id }, include: { candidateProfile: true } }); }
export async function allocateCandidateCandidates(opportunityId: string, matches: CandidateMatch[], actorUserId?: string) { return prisma.$transaction(async (tx) => {
  const opportunity = await lock(tx, opportunityId); if (!opportunity || opportunity.type !== OpportunityType.CANDIDATE) throw new NotFoundError("Candidate not found");
  const existing = await tx.opportunityAllocation.findMany({ where: { opportunityId, status: { in: active } }, select: { companyId: true } }); let slots = Math.max(0, opportunity.maxBuyersPerOpportunity - existing.length); const used = new Set(existing.map((item) => item.companyId)); const allocations = [];
  for (const match of matches) { if (!slots) break; if (used.has(match.companyId)) continue; await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${match.companyId}::uuid FOR UPDATE`;
    const [company, mandate, preference, rule, delivered] = await Promise.all([tx.company.findUnique({ where: { id: match.companyId } }), tx.sepaMandate.findFirst({ where: { companyId: match.companyId, status: "ACTIVE" } }), tx.candidatePreference.findFirst({ where: { companyId: match.companyId, active: true, category: opportunity.category } }), tx.pricingRule.findFirst({ where: { id: match.pricingRuleId, companyId: match.companyId, active: true, opportunityType: OpportunityType.CANDIDATE } }), tx.opportunityAllocation.count({ where: { companyId: match.companyId, allocatedAt: { gte: weekStart() }, status: { in: active } } })]);
    if (!company || company.status !== "ACTIVE" || !company.candidateDeliveryActive || !mandate || !preference || !rule || (preference.maxWeeklyCandidates != null && delivered >= preference.maxWeeklyCandidates)) continue;
    const price = opportunity.exclusive ? (rule.exclusivePriceCents ?? rule.priceCents) : (rule.sharedPriceCents ?? rule.priceCents); if (preference.maxPriceCents != null && price > preference.maxPriceCents) continue;
    const allocation = await tx.opportunityAllocation.create({ data: { companyId: match.companyId, opportunityId, pricingRuleId: rule.id, score: match.score, priceCents: price, currency: rule.currency, priceSnapshot: { opportunityType: "CANDIDATE", pricingRuleId: rule.id, priceCents: price, currency: rule.currency, capturedAt: new Date().toISOString() }, status: AllocationStatus.ACCEPTED, acceptedAt: new Date(), candidateStatus: CandidateStatus.NEW } });
    const start = weekStart(); const minimum = preference.minimumWeeklyCandidates ?? 1; await tx.weeklyCommitment.upsert({ where: { companyId_weekStart_opportunityType: { companyId: match.companyId, weekStart: start, opportunityType: OpportunityType.CANDIDATE } }, create: { companyId: match.companyId, weekStart: start, opportunityType: OpportunityType.CANDIDATE, minimumLeads: minimum, deliveredLeads: 1, billableLeads: 1, shortfall: Math.max(minimum - 1, 0) }, update: { deliveredLeads: { increment: 1 }, billableLeads: { increment: 1 } } });
    await tx.$executeRaw`UPDATE "WeeklyCommitment" SET "shortfall" = GREATEST("minimumLeads" - "deliveredLeads", 0) WHERE "companyId" = ${match.companyId}::uuid AND "weekStart" = ${start} AND "opportunityType" = 'CANDIDATE'::"OpportunityType"`;
    await tx.auditLog.create({ data: { companyId: match.companyId, actorUserId, actorType: actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM, action: "candidate.allocated", entityType: "OpportunityAllocation", entityId: allocation.id, opportunityId, metadata: { priceCents: price, score: match.score, manual: Boolean(actorUserId) } } });
    await enqueueOutboxEvent(tx, { dedupeKey: `notification:new-candidate:${allocation.id}`, eventType: COMPANY_EMAIL_OUTBOX_EVENT, aggregateType: "OpportunityAllocation", aggregateId: allocation.id, companyId: match.companyId, payload: { eventType: notificationEvents.newCandidate, subject: "Nieuwe kandidaat in LinkConnect", text: `Nieuwe kandidaat voor ${opportunity.service ?? opportunity.category} uit ${opportunity.region ?? opportunity.city ?? "jouw regio"}. Bekijk de kandidaat in je beveiligde dashboard.` } });
    allocations.push(allocation); used.add(match.companyId); slots--;
  }
  if (allocations.length) await tx.opportunity.update({ where: { id: opportunityId }, data: { status: "ALLOCATED" } }); return allocations;
}); }
export async function allocateCandidate(input: Pick<CandidateMatch, "companyId" | "pricingRuleId" | "score"> & { opportunityId: string; actorUserId?: string }) {
  const allocations = await allocateCandidateCandidates(input.opportunityId, [{
    ...input,
    priceCents: 0,
    currency: "EUR",
  }], input.actorUserId);
  const allocation = allocations[0];
  if (allocation) return allocation;

  const existing = await prisma.opportunityAllocation.findUnique({
    where: { companyId_opportunityId: { companyId: input.companyId, opportunityId: input.opportunityId } },
  });
  if (existing) return existing;
  throw new ConflictError("Candidate has no remaining buyer capacity or target company is not eligible");
}

export async function updateCandidateStatus(input: {
  companyId: string;
  opportunityId: string;
  status: CandidateStatus;
  actorUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const allocation = await tx.opportunityAllocation.findFirst({
      where: { companyId: input.companyId, opportunityId: input.opportunityId },
      select: { id: true },
    });
    if (!allocation) throw new NotFoundError("Candidate not found");
    const updated = await tx.opportunityAllocation.update({
      where: { id: allocation.id },
      data: { candidateStatus: input.status, viewedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        actorType: AuditActorType.USER,
        action: "candidate.company_status_updated",
        entityType: "OpportunityAllocation",
        entityId: allocation.id,
        opportunityId: input.opportunityId,
        metadata: { status: input.status },
      },
    });
    return updated;
  });
}
