import { AuditActorType, LeadStatus, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { z } from "zod";

import type { IngestReplayClaim } from "@/lib/api-keys";
import { ConflictError } from "@/lib/http";
import { enqueueOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";

const consentSchema = z.object({
  accepted: z.literal(true),
  capturedAt: z.coerce.date(),
  version: z.string().trim().min(1).max(64),
  source: z.string().trim().min(1).max(128),
  ipHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  userAgentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  proofHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  marketingAllowed: z.boolean().default(false),
  metadata: z.record(z.string().max(64), z.unknown()).default({}),
});

export const leadIngestSchema = z.object({
  sourceWebsite: z.string().trim().min(1).max(255),
  externalLeadId: z.string().trim().min(1).max(128),
  category: z.string().trim().min(1).max(100),
  service: z.string().trim().min(1).max(160),
  customerName: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().min(5).max(40).optional(),
  postcode: z.string().trim().min(2).max(16).transform((value) => value.toUpperCase()),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5000),
  metadata: z.record(z.string().max(64), z.unknown()).default({}),
  createdAt: z.coerce.date(),
  consentAt: z.coerce.date().optional(),
  // Structured consent is required for every new API lead. The legacy
  // consentAt field remains accepted only as metadata for older clients.
  consent: consentSchema,
  maxBuyersPerLead: z.number().int().min(1).max(20).default(1),
}).superRefine((lead, context) => {
  if (!lead.email && !lead.phone) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "lead requires an email or phone number" });
  }
  const now = new Date();
  if (lead.createdAt > now) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["createdAt"], message: "createdAt cannot be in the future" });
  }
  const capturedAt = lead.consent.capturedAt;
  if (capturedAt && capturedAt > now) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["consent"], message: "consent cannot be in the future" });
  }
  if (lead.consent.capturedAt > lead.createdAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["consent", "capturedAt"], message: "consent must be captured before the lead was created" });
  }
});

export type LeadIngest = z.infer<typeof leadIngestSchema>;

export type IngestLeadResult = {
  leadId: string;
  duplicate: boolean;
  allocationIds: string[];
};

export function slugifyLeadValue(value: string) {
  return value.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function sourceWebsiteMatchesDomain(sourceWebsite: string, domain: string) {
  try {
    const hostname = new URL(sourceWebsite).hostname.toLowerCase().replace(/^www\./, "");
    const normalizedDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
  } catch {
    return false;
  }
}

export function clampRecipientsToSourcePolicy(requestedRecipients: number, sourceMaximum: number) {
  return Math.min(requestedRecipients, sourceMaximum);
}

function leadFingerprint(leadSourceId: string, externalId: string) {
  return createHash("sha256").update(`${leadSourceId}:${externalId}`).digest("hex");
}

export async function ingestLead(input: {
  companyId: string;
  apiKeyId: string;
  leadSourceId: string;
  lead: LeadIngest;
  requestId?: string;
  replay?: IngestReplayClaim;
}): Promise<IngestLeadResult> {
  const fingerprint = leadFingerprint(input.leadSourceId, input.lead.externalLeadId);

  try {
    return await prisma.$transaction(async (tx) => {
      const source = await tx.leadSource.findUnique({
        where: { id: input.leadSourceId },
        select: {
          id: true,
          companyId: true,
          domain: true,
          status: true,
          allowedCategorySlugs: true,
          allowedServices: true,
          maxRecipientsPerLead: true,
          company: { select: { status: true } },
        },
      });
      if (!source || source.companyId !== input.companyId || source.status !== "ACTIVE" || source.company.status !== "ACTIVE") {
        throw new ConflictError("Lead source is not active for this publisher");
      }
      const categorySlug = slugifyLeadValue(input.lead.category);
      const serviceSlug = slugifyLeadValue(input.lead.service);
      if (source.allowedCategorySlugs.length > 0 && !source.allowedCategorySlugs.includes(categorySlug)) {
        throw new ConflictError("Lead category is not allowed for this source");
      }
      if (source.allowedServices.length > 0 && !source.allowedServices.includes(serviceSlug)) {
        throw new ConflictError("Lead service is not allowed for this source");
      }
      const sourceWebsite = source.domain
        ? sourceWebsiteMatchesDomain(input.lead.sourceWebsite, source.domain)
          ? `https://${source.domain}`
          : null
        : input.lead.sourceWebsite;
      if (!sourceWebsite) throw new ConflictError("Lead source website does not match the credential policy");
      const maxBuyersPerLead = clampRecipientsToSourcePolicy(input.lead.maxBuyersPerLead, source.maxRecipientsPerLead);

      if (input.replay) {
        await tx.ingestReplay.create({
          data: {
            apiKeyId: input.apiKeyId,
            replayKey: input.replay.replayKey,
            requestHash: input.replay.requestHash,
            expiresAt: input.replay.expiresAt,
          },
        });
      }

      const existing = await tx.lead.findFirst({
        where: { leadSourceId: source.id, externalId: input.lead.externalLeadId },
        select: { id: true, allocations: { select: { id: true } } },
      });
      if (existing) {
        return { leadId: existing.id, duplicate: true, allocationIds: existing.allocations.map((allocation) => allocation.id) };
      }

      const created = await tx.lead.create({
        data: {
          sourceCompanyId: input.companyId,
          leadSourceId: source.id,
          sourceApiKeyId: input.apiKeyId,
          externalId: input.lead.externalLeadId,
          fingerprint,
          status: LeadStatus.NEW,
          category: input.lead.category,
          service: input.lead.service,
          sourceWebsite,
          postalCode: input.lead.postcode,
          city: input.lead.city,
          region: input.lead.region,
          description: input.lead.description,
          maxBuyersPerLead,
          exclusive: maxBuyersPerLead === 1,
          consentAt: input.lead.consent.capturedAt,
          receivedAt: input.lead.createdAt,
          contact: { name: input.lead.customerName, email: input.lead.email, phone: input.lead.phone } as Prisma.InputJsonValue,
          attributes: input.lead.metadata as Prisma.InputJsonValue,
        },
      });
      const consent = input.lead.consent;
      await tx.leadConsent.create({
        data: {
          leadId: created.id,
          capturedAt: consent.capturedAt,
          version: consent.version,
          source: consent.source,
          ipHash: consent.ipHash,
          userAgentHash: consent.userAgentHash,
          proofHash: consent.proofHash,
          marketingAllowed: consent.marketingAllowed,
          metadata: consent.metadata as Prisma.InputJsonValue,
        },
      });
      await tx.leadSource.update({ where: { id: source.id }, data: { lastUsedAt: new Date() } });
      await tx.auditLog.create({
        data: {
          companyId: input.companyId,
          actorApiKeyId: input.apiKeyId,
          actorType: AuditActorType.API_KEY,
          action: "lead.ingested",
          entityType: "Lead",
          entityId: created.id,
          leadId: created.id,
          requestId: input.requestId,
          metadata: {
            category: input.lead.category,
            requestedRecipients: input.lead.maxBuyersPerLead,
            maxRecipientsPerLead: maxBuyersPerLead,
            recipientCapApplied: maxBuyersPerLead !== input.lead.maxBuyersPerLead,
          },
        },
      });
      await enqueueOutboxEvent(tx, {
        dedupeKey: `lead.ingested:${created.id}`,
        eventType: "lead.ingested",
        aggregateType: "Lead",
        aggregateId: created.id,
        companyId: input.companyId,
        payload: {
          leadId: created.id,
          sourceCompanyId: input.companyId,
          sourceApiKeyId: input.apiKeyId,
        },
      });
      return { leadId: created.id, duplicate: false, allocationIds: [] };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
      if (target.includes("IngestReplay") || (target.includes("apiKeyId") && target.includes("replayKey"))) {
        throw new ConflictError("Request replay detected");
      }
      if (target.includes("Lead_leadSourceId_externalId") || (target.includes("leadSourceId") && target.includes("externalId"))) {
        const duplicate = await prisma.lead.findFirst({ where: { leadSourceId: input.leadSourceId, externalId: input.lead.externalLeadId }, select: { id: true, allocations: { select: { id: true } } } });
        if (duplicate) return { leadId: duplicate.id, duplicate: true, allocationIds: duplicate.allocations.map((allocation) => allocation.id) };
      }
    }
    throw error;
  }
}
