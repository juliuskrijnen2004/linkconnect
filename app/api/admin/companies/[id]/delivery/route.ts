import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ConflictError, errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ leadDeliveryActive: z.boolean(), minimumWeeklyLeads: z.number().int().min(2).max(100) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const { id } = await params;
    const companyId = z.string().uuid().parse(id);
    const input = schema.parse(await request.json());
    await prisma.$transaction(async (tx) => {
      const [company, mandate] = await Promise.all([tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { status: true } }), tx.sepaMandate.findFirst({ where: { companyId, status: "ACTIVE" }, select: { id: true } })]);
      if (input.leadDeliveryActive && (company.status !== "ACTIVE" || !mandate)) throw new ConflictError("Delivery requires an active company and SEPA mandate");
      await tx.company.update({ where: { id: companyId }, data: input });
      await tx.auditLog.create({ data: { companyId, actorUserId: session.userId, actorType: "USER", action: "admin.company_delivery_updated", entityType: "Company", entityId: companyId, metadata: input } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
