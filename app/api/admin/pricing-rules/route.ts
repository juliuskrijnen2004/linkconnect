import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ConflictError, errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ companyId: z.string().uuid(), name: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(100), postalPrefixes: z.array(z.string().trim().min(1).max(16)).max(100).default([]), priceCents: z.number().int().min(0).max(10_000_000), currency: z.string().regex(/^[A-Z]{3}$/).default("EUR"), priority: z.number().int().min(-100).max(100).default(0), active: z.boolean().default(true) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const input = schema.parse(await request.json());
    const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { id: true } });
    if (!company) throw new ConflictError("Company does not exist");
    const pricingRule = await prisma.$transaction(async (tx) => {
      const created = await tx.pricingRule.create({ data: { ...input, postalPrefixes: [...new Set(input.postalPrefixes.map((prefix) => prefix.toUpperCase()))] } });
      await tx.auditLog.create({ data: { companyId: input.companyId, actorUserId: session.userId, actorType: "USER", action: "admin.pricing_rule_created", entityType: "PricingRule", entityId: created.id, metadata: { category: created.category, priceCents: created.priceCents, currency: created.currency } } });
      return created;
    });
    return Response.json({ pricingRule }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
