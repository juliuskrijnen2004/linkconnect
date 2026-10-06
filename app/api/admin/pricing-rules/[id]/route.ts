import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ name: z.string().trim().min(1).max(160).optional(), category: z.string().trim().min(1).max(100).optional(), postalPrefixes: z.array(z.string().trim().min(1).max(16)).max(100).optional(), priceCents: z.number().int().min(0).max(10_000_000).optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), priority: z.number().int().min(-100).max(100).optional(), active: z.boolean().optional() }).refine((input) => Object.keys(input).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const { id } = await params;
    const pricingRuleId = z.string().uuid().parse(id);
    const input = schema.parse(await request.json());
    const pricingRule = await prisma.$transaction(async (tx) => {
      const updated = await tx.pricingRule.update({ where: { id: pricingRuleId }, data: { ...input, postalPrefixes: input.postalPrefixes ? [...new Set(input.postalPrefixes.map((prefix) => prefix.toUpperCase()))] : undefined } });
      await tx.auditLog.create({ data: { companyId: updated.companyId, actorUserId: session.userId, actorType: "USER", action: "admin.pricing_rule_updated", entityType: "PricingRule", entityId: pricingRuleId, metadata: input } });
      return updated;
    });
    return Response.json({ pricingRule });
  } catch (error) {
    return errorResponse(error);
  }
}
