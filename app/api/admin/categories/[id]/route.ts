import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ name: z.string().trim().min(1).max(160).optional(), description: z.string().trim().max(2_000).nullable().optional(), defaultPriceCents: z.number().int().min(0).max(10_000_000).optional(), active: z.boolean().optional() }).refine((input) => Object.keys(input).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const { id } = await params;
    const categoryId = z.string().uuid().parse(id);
    const input = schema.parse(await request.json());
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.leadCategory.update({ where: { id: categoryId }, data: input });
      await tx.auditLog.create({ data: { actorUserId: session.userId, actorType: "USER", action: "admin.category_updated", entityType: "LeadCategory", entityId: categoryId, metadata: input } });
      return updated;
    });
    return Response.json({ category });
  } catch (error) {
    return errorResponse(error);
  }
}
