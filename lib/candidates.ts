import { AuditActorType, OpportunityType, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { z } from "zod";

import type { IngestReplayClaim } from "@/lib/api-keys";
import { clampRecipientsToSourcePolicy, slugifyLeadValue, sourceWebsiteMatchesDomain } from "@/lib/leads";
import { ConflictError } from "@/lib/http";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";

const consentSchema = z.object({
  consentGiven: z.literal(true), consentTextVersion: z.string().trim().min(1).max(64),
  consentTimestamp: z.coerce.date(), privacyPolicyVersion: z.string().trim().min(1).max(64),
  sourceWebsite: z.string().trim().min(1).max(255), ipHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  userAgentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(), proofHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  metadata: z.record(z.string().max(64), z.unknown()).default({}),
});

export const candidateIngestSchema = z.object({
  sourceWebsite: z.string().trim().min(1).max(255), externalCandidateId: z.string().trim().min(1).max(128),
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320).optional(), phone: z.string().trim().min(5).max(40).optional(),
  postcode: z.string().trim().min(2).max(16).transform((value) => value.toUpperCase()), city: z.string().trim().min(1).max(120), region: z.string().trim().min(1).max(120),
  jobCategory: z.string().trim().min(1).max(100), desiredRole: z.string().trim().min(1).max(160),
  availableHours: z.number().int().min(1).max(80).optional(), availableDays: z.array(z.string().trim().min(1).max(32)).max(7).default([]),
  desiredDistanceKm: z.number().int().min(0).max(250).optional(), educationLevel: z.string().trim().max(120).optional(),
  experienceYears: z.number().int().min(0).max(60).optional(), driversLicense: z.boolean().default(false), availabilityDate: z.coerce.date().optional(),
  salaryIndication: z.number().int().min(0).max(1_000_000).optional(), motivation: z.string().trim().max(5000).optional(), cvUrl: z.string().url().max(2048).optional(),
  answers: z.record(z.string().max(64), z.unknown()).default({}), metadata: z.record(z.string().max(64), z.unknown()).default({}),
  createdAt: z.coerce.date(), consent: consentSchema, maxBuyersPerCandidate: z.number().int().min(1).max(20).default(1),
}).superRefine((candidate, context) => {
  if (!candidate.email && !candidate.phone) context.addIssue({ code: z.ZodIssueCode.custom, message: "candidate requires an email or phone number" });
  if (candidate.createdAt > new Date()) context.addIssue({ code: z.ZodIssueCode.custom, path: ["createdAt"], message: "createdAt cannot be in the future" });
  if (candidate.consent.consentTimestamp > candidate.createdAt) context.addIssue({ code: z.ZodIssueCode.custom, path: ["consent"], message: "consent must be captured before the candidate was created" });
});
export type CandidateIngest = z.infer<typeof candidateIngestSchema>;
export type IngestCandidateResult = { opportunityId: string; duplicate: boolean; allocationIds: string[] };

export async function ingestCandidate(input: { companyId: string; apiKeyId: string; leadSourceId: string; candidate: CandidateIngest; requestId?: string; replay?: IngestReplayClaim }): Promise<IngestCandidateResult> {
  const fingerprint = createHash("sha256").update(`${input.leadSourceId}:${input.candidate.externalCandidateId}:CANDIDATE`).digest("hex");
  try {
    return await prisma.$transaction(async (tx) => {
      const source = await tx.leadSource.findUnique({ where: { id: input.leadSourceId }, include: { company: { select: { status: true } } } });
      if (!source || source.companyId !== input.companyId || source.status !== "ACTIVE" || source.company.status !== "ACTIVE") throw new ConflictError("Lead source is not active for this publisher");
      const category = slugifyLeadValue(input.candidate.jobCategory);
      const role = slugifyLeadValue(input.candidate.desiredRole);
      if (source.allowedCategorySlugs.length && !source.allowedCategorySlugs.includes(category)) throw new ConflictError("Candidate category is not allowed for this source");
      if (source.allowedServices.length && !source.allowedServices.includes(role)) throw new ConflictError("Candidate role is not allowed for this source");
      const sourceWebsite = source.domain ? sourceWebsiteMatchesDomain(input.candidate.sourceWebsite, source.domain) ? `https://${source.domain}` : null : input.candidate.sourceWebsite;
      if (!sourceWebsite) throw new ConflictError("Candidate source website does not match the credential policy");
      if (input.replay) await tx.ingestReplay.create({ data: { apiKeyId: input.apiKeyId, replayKey: input.replay.replayKey, requestHash: input.replay.requestHash, expiresAt: input.replay.expiresAt } });
      const existing = await tx.opportunity.findFirst({ where: { leadSourceId: source.id, externalId: input.candidate.externalCandidateId, type: OpportunityType.CANDIDATE }, include: { allocations: { select: { id: true } } } });
      if (existing) return { opportunityId: existing.id, duplicate: true, allocationIds: existing.allocations.map((allocation) => allocation.id) };
      const maxBuyers = clampRecipientsToSourcePolicy(input.candidate.maxBuyersPerCandidate, source.maxRecipientsPerLead);
      const created = await tx.opportunity.create({ data: {
        type: OpportunityType.CANDIDATE, sourceCompanyId: input.companyId, leadSourceId: source.id, sourceApiKeyId: input.apiKeyId,
        externalId: input.candidate.externalCandidateId, duplicateFingerprint: fingerprint, category: input.candidate.jobCategory, service: input.candidate.desiredRole,
        sourceWebsite, city: input.candidate.city, region: input.candidate.region, postalCode: input.candidate.postcode, firstName: input.candidate.firstName, lastName: input.candidate.lastName,
        email: input.candidate.email, phone: input.candidate.phone, maxBuyersPerOpportunity: maxBuyers, exclusive: maxBuyers === 1, metadata: input.candidate.metadata as Prisma.InputJsonValue,
        consentAt: input.candidate.consent.consentTimestamp, receivedAt: input.candidate.createdAt,
        candidateProfile: { create: { desiredRole: input.candidate.desiredRole, jobCategory: input.candidate.jobCategory, desiredDistanceKm: input.candidate.desiredDistanceKm, availableHours: input.candidate.availableHours, availableDays: input.candidate.availableDays, educationLevel: input.candidate.educationLevel, experienceYears: input.candidate.experienceYears, driversLicense: input.candidate.driversLicense, availabilityDate: input.candidate.availabilityDate, salaryIndication: input.candidate.salaryIndication, motivation: input.candidate.motivation, cvUrl: input.candidate.cvUrl, answers: input.candidate.answers as Prisma.InputJsonValue } },
        consentProof: { create: { consentGiven: true, consentTextVersion: input.candidate.consent.consentTextVersion, consentTimestamp: input.candidate.consent.consentTimestamp, privacyPolicyVersion: input.candidate.consent.privacyPolicyVersion, sourceWebsite, ipHash: input.candidate.consent.ipHash, userAgentHash: input.candidate.consent.userAgentHash, proofHash: input.candidate.consent.proofHash, metadata: input.candidate.consent.metadata as Prisma.InputJsonValue } },
      } });
      await tx.leadSource.update({ where: { id: source.id }, data: { lastUsedAt: new Date() } });
      await tx.auditLog.create({ data: { companyId: input.companyId, actorApiKeyId: input.apiKeyId, actorType: AuditActorType.API_KEY, action: "candidate.ingested", entityType: "Opportunity", entityId: created.id, opportunityId: created.id, requestId: input.requestId, metadata: { category: input.candidate.jobCategory, requestedRecipients: input.candidate.maxBuyersPerCandidate, maxRecipients: maxBuyers } } });
      await enqueueOutboxEvent(tx, { dedupeKey: `candidate.ingested:${created.id}`, eventType: "candidate.ingested", aggregateType: "Opportunity", aggregateId: created.id, companyId: input.companyId, payload: { opportunityId: created.id } });
      return { opportunityId: created.id, duplicate: false, allocationIds: [] };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = String(error.meta?.target ?? "");
      if (target.includes("IngestReplay") || target.includes("replayKey")) throw new ConflictError("Request replay detected");
      const duplicate = await prisma.opportunity.findFirst({ where: { leadSourceId: input.leadSourceId, externalId: input.candidate.externalCandidateId, type: OpportunityType.CANDIDATE }, include: { allocations: { select: { id: true } } } });
      if (duplicate) return { opportunityId: duplicate.id, duplicate: true, allocationIds: duplicate.allocations.map((allocation) => allocation.id) };
    }
    throw error;
  }
}
