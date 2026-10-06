import { AllocationStatus, AuditActorType, DisputeStatus } from "@prisma/client";

import { ConflictError, NotFoundError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const unresolvedDisputeStatuses: DisputeStatus[] = [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW];

export async function openDispute(input: { companyId: string; allocationId: string; openedByUserId: string; reason: string; notes?: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Allocation" WHERE "id" = ${input.allocationId}::uuid FOR UPDATE`;
    const allocation = await tx.allocation.findFirst({ where: { id: input.allocationId, companyId: input.companyId }, select: { id: true, status: true } });
    if (!allocation) throw new NotFoundError("Allocation not found in tenant");
    if (allocation.status === AllocationStatus.CREDITED || allocation.status === AllocationStatus.REJECTED || allocation.status === AllocationStatus.EXPIRED) throw new ConflictError("This allocation cannot be disputed");
    const existing = await tx.dispute.findFirst({ where: { allocationId: allocation.id, status: { in: unresolvedDisputeStatuses } }, select: { id: true } });
    if (existing) throw new ConflictError("An open dispute already exists for this allocation");
    const dispute = await tx.dispute.create({ data: { companyId: input.companyId, allocationId: allocation.id, openedByUserId: input.openedByUserId, reason: input.reason, notes: input.notes } });
    await tx.allocation.update({ where: { id: allocation.id }, data: { status: AllocationStatus.DISPUTED, companyStatus: "DISPUTED" } });
    await tx.auditLog.create({
      data: { companyId: input.companyId, actorUserId: input.openedByUserId, actorType: AuditActorType.USER, action: "dispute.opened", entityType: "Dispute", entityId: dispute.id, allocationId: allocation.id, disputeId: dispute.id, metadata: { reason: input.reason } },
    });
    return dispute;
  });
}

export async function resolveDispute(input: { disputeId: string; decision: "APPROVE_CREDIT" | "REJECT"; resolution: string; actorUserId: string }) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Dispute" WHERE "id" = ${input.disputeId}::uuid FOR UPDATE`;
    const dispute = await tx.dispute.findUnique({ where: { id: input.disputeId }, include: { allocation: { include: { invoiceLine: { include: { invoice: true } } } } } });
    if (!dispute) throw new NotFoundError("Dispute not found");
    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) throw new ConflictError("Dispute has already been resolved");

    if (input.decision === "APPROVE_CREDIT") {
      const line = dispute.allocation.invoiceLine;
      if (line && line.invoice.status !== "DRAFT") {
        // Finalized invoices require a Stripe credit note or refund; the webhook records it.
        throw new ConflictError("Finalized invoices require a Stripe credit note or refund before the dispute can be credited");
      }
      if (line) {
        await tx.invoice.update({ where: { id: line.invoiceId }, data: { subtotalCents: { decrement: line.totalCents }, totalCents: { decrement: line.totalCents } } });
        await tx.invoiceLine.delete({ where: { id: line.id } });
      }
      await tx.allocation.update({ where: { id: dispute.allocationId }, data: { status: AllocationStatus.CREDITED, companyStatus: "DISPUTED" } });
      await tx.dispute.update({ where: { id: dispute.id }, data: { status: DisputeStatus.RESOLVED_COMPANY, resolution: input.resolution, resolvedAt: new Date() } });
    } else {
      await tx.allocation.update({ where: { id: dispute.allocationId }, data: { status: AllocationStatus.ACCEPTED, companyStatus: "NEW" } });
      await tx.dispute.update({ where: { id: dispute.id }, data: { status: DisputeStatus.REJECTED, resolution: input.resolution, resolvedAt: new Date() } });
    }
    await tx.auditLog.create({
      data: { companyId: dispute.companyId, actorUserId: input.actorUserId, actorType: AuditActorType.USER, action: input.decision === "APPROVE_CREDIT" ? "dispute.credited" : "dispute.rejected", entityType: "Dispute", entityId: dispute.id, allocationId: dispute.allocationId, disputeId: dispute.id, metadata: { invoiceId: dispute.allocation.invoiceLine?.invoiceId ?? null } },
    });
    return { id: dispute.id, status: input.decision === "APPROVE_CREDIT" ? DisputeStatus.RESOLVED_COMPANY : DisputeStatus.REJECTED };
  });
}
