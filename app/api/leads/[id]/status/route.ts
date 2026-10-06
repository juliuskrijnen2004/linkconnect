import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum(["NEW", "VIEWED", "CONTACTED", "APPOINTMENT", "WON", "LOST", "DISPUTED"]), notes: z.string().max(4000).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireCompanySession();
    if (!session.companyId) return Response.json({ error: "Company required" }, { status: 403 });
    const { id } = await params;
    const leadId = z.string().uuid().parse(id);
    const input = schema.parse(Object.fromEntries(await request.formData()));
    const allocation = await prisma.allocation.findFirst({ where: { companyId: session.companyId, leadId }, select: { id: true } });
    if (!allocation) return Response.json({ error: "Lead not found" }, { status: 404 });
    await prisma.$transaction([
      prisma.allocation.update({ where: { id: allocation.id }, data: { companyStatus: input.status, internalNotes: input.notes || null, viewedAt: input.status === "VIEWED" ? new Date() : undefined } }),
      prisma.auditLog.create({ data: { companyId: session.companyId, actorUserId: session.userId, actorType: "USER", action: "allocation.company_status_updated", entityType: "Allocation", entityId: allocation.id, allocationId: allocation.id, leadId, metadata: { status: input.status, hasNotes: Boolean(input.notes) } } }),
    ]);
    return NextResponse.redirect(new URL(`/dashboard/leads/${leadId}?saved=1`, request.url), 303);
  } catch (error) {
    return errorResponse(error);
  }
}
