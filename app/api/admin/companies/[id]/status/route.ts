import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ConflictError, errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { COMPANY_EMAIL_OUTBOX_EVENT, notificationEvents } from "@/lib/notifications";
import { enqueueOutboxEvent } from "@/lib/outbox";

const schema = z.object({ status: z.enum(["PENDING", "ACTIVE", "PAUSED", "REJECTED"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const { id } = await params;
    const companyId = z.string().uuid().parse(id);
    const input = schema.parse(Object.fromEntries(await request.formData()));
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select: { leadDeliveryActive: true } });
      const mandate = await tx.sepaMandate.findFirst({ where: { companyId, status: "ACTIVE" }, select: { id: true } });
      if (input.status === "ACTIVE" && !mandate) throw new ConflictError("An active SEPA mandate is required before activation");
      const deliveryActive = input.status === "ACTIVE" ? company.leadDeliveryActive : false;
      await tx.company.update({ where: { id: companyId }, data: { status: input.status, leadDeliveryActive: deliveryActive, approvedAt: input.status === "ACTIVE" ? new Date() : undefined, pausedAt: input.status === "PAUSED" ? new Date() : null } });
      await tx.auditLog.create({ data: { companyId, actorUserId: session.userId, actorType: "USER", action: "admin.company_status_updated", entityType: "Company", entityId: companyId, metadata: { status: input.status, deliveryActive } } });
      await enqueueOutboxEvent(tx, {
        dedupeKey: `notification:account-status:${companyId}:${input.status}`,
        eventType: COMPANY_EMAIL_OUTBOX_EVENT,
        aggregateType: "Company",
        aggregateId: companyId,
        companyId,
        payload: {
          eventType: notificationEvents.accountUpdated,
          subject: "Je LinkConnect-account is bijgewerkt",
          text: `De status van je LinkConnect-account is gewijzigd naar ${input.status}. Log in voor meer informatie.`,
        },
      });
    });
    return NextResponse.redirect(new URL("/admin/bedrijven?saved=1", request.url), 303);
  } catch (error) {
    return errorResponse(error);
  }
}
