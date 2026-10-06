import { AuditActorType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type AuditEvent = {
  companyId?: string;
  actorType: AuditActorType;
  actorUserId?: string;
  actorApiKeyId?: string;
  action: string;
  entityType: string;
  entityId: string;
  requestId?: string;
  leadId?: string;
  allocationId?: string;
  invoiceId?: string;
  disputeId?: string;
  metadata?: Prisma.InputJsonValue;
};

// Never include unredacted contact data, API keys, HMAC values, or payment details.
export async function writeAuditLog(event: AuditEvent) {
  return prisma.auditLog.create({
    data: {
      ...event,
      metadata: event.metadata ?? {},
    },
  });
}
