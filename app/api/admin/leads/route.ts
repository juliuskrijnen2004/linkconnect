import { createHash } from "crypto";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ConflictError, errorResponse } from "@/lib/http";
import { clampRecipientsToSourcePolicy } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  leadSourceId: z.string().uuid(), externalId: z.string().trim().min(1).max(128), category: z.string().trim().min(1).max(100), service: z.string().trim().max(160).optional(), sourceWebsite: z.string().trim().url().optional(), customerName: z.string().trim().min(1).max(200), email: z.string().trim().email().max(320).optional(), phone: z.string().trim().min(5).max(40).optional(), postalCode: z.string().trim().min(2).max(16), city: z.string().trim().min(1).max(120), region: z.string().trim().min(1).max(120), description: z.string().trim().min(1).max(5000), consentAt: z.coerce.date(), maxBuyersPerLead: z.number().int().min(1).max(20).default(1),
}).refine((lead) => Boolean(lead.email || lead.phone), { message: "Lead requires an email or phone number" });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const input = schema.parse(await request.json());
    const fingerprint = createHash("sha256").update(`${input.leadSourceId}:${input.externalId}`).digest("hex");
    const lead = await prisma.$transaction(async (tx) => {
      const source = await tx.leadSource.findUnique({ where: { id: input.leadSourceId } });
      if (!source || source.status !== "ACTIVE") throw new ConflictError("Active lead source does not exist");
      const maxBuyersPerLead = clampRecipientsToSourcePolicy(input.maxBuyersPerLead, source.maxRecipientsPerLead);
      const existing = await tx.lead.findFirst({ where: { leadSourceId: source.id, externalId: input.externalId }, select: { id: true } });
      if (existing) throw new ConflictError("A lead with this source and external ID already exists");
      const created = await tx.lead.create({
        data: {
          sourceCompanyId: source.companyId, leadSourceId: source.id, externalId: input.externalId, fingerprint, category: input.category, service: input.service, sourceWebsite: input.sourceWebsite, postalCode: input.postalCode.toUpperCase(), city: input.city, region: input.region, description: input.description, consentAt: input.consentAt, maxBuyersPerLead, exclusive: maxBuyersPerLead === 1, contact: { name: input.customerName, email: input.email, phone: input.phone }, attributes: { processingMode: "manual-allocation" },
        },
      });
      await tx.leadConsent.create({ data: { leadId: created.id, capturedAt: input.consentAt, version: "admin-entry-v1", source: "linkconnect-admin", marketingAllowed: false, metadata: { recordedByUserId: session.userId } } });
      await tx.auditLog.create({ data: { companyId: source.companyId, actorUserId: session.userId, actorType: "USER", action: "admin.lead_created", entityType: "Lead", entityId: created.id, leadId: created.id, metadata: { category: input.category, requestedRecipients: input.maxBuyersPerLead, maxRecipientsPerLead: maxBuyersPerLead, recipientCapApplied: maxBuyersPerLead !== input.maxBuyersPerLead, processingMode: "manual-allocation", leadSourceId: source.id } } });
      return created;
    });
    return Response.json({ lead }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
