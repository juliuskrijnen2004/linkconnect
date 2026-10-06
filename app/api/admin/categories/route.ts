import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ConflictError, errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100), name: z.string().trim().min(1).max(160), description: z.string().trim().max(2_000).optional(), defaultPriceCents: z.number().int().min(0).max(10_000_000), active: z.boolean().default(true) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const input = schema.parse(await request.json());
    const existing = await prisma.leadCategory.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (existing) throw new ConflictError("Category slug already exists");
    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.leadCategory.create({ data: input });
      await tx.auditLog.create({ data: { actorUserId: session.userId, actorType: "USER", action: "admin.category_created", entityType: "LeadCategory", entityId: created.id, metadata: { slug: created.slug, defaultPriceCents: created.defaultPriceCents } } });
      return created;
    });
    return Response.json({ category }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
