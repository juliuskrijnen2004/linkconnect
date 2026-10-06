import { OutboxStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type OutboxEventInput = {
  dedupeKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  companyId?: string;
  payload: Prisma.InputJsonValue;
  availableAt?: Date;
};

type OutboxClient = Pick<Prisma.TransactionClient, "outboxEvent">;

/**
 * Add an event in the caller's transaction. The unique dedupe key makes this
 * safe when a retry reaches the database after the original transaction has
 * committed.
 */
export async function enqueueOutboxEvent(client: OutboxClient, input: OutboxEventInput) {
  return client.outboxEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    create: {
      dedupeKey: input.dedupeKey,
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      companyId: input.companyId,
      payload: input.payload,
      availableAt: input.availableAt,
    },
    update: {},
  });
}

export async function claimOutboxBatch(limit = 25, now = new Date()) {
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return prisma.$transaction(async (tx) => {
    // A crashed worker leaves a lease behind. Requeue only stale leases so a
    // second worker can safely recover the event without double processing.
    const leaseCutoff = new Date(now.getTime() - 10 * 60 * 1000);
    await tx.outboxEvent.updateMany({
      where: { status: OutboxStatus.PROCESSING, lockedAt: { lt: leaseCutoff } },
      data: { status: OutboxStatus.PENDING, lockedAt: null },
    });
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "OutboxEvent"
      WHERE "status" = 'PENDING'::"OutboxStatus"
        AND "availableAt" <= ${now}
      ORDER BY "availableAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${boundedLimit}
    `;
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    await tx.outboxEvent.updateMany({
      where: { id: { in: ids }, status: OutboxStatus.PENDING },
      data: { status: OutboxStatus.PROCESSING, lockedAt: now, attempts: { increment: 1 } },
    });
    return tx.outboxEvent.findMany({ where: { id: { in: ids }, status: OutboxStatus.PROCESSING }, orderBy: { createdAt: "asc" } });
  });
}

export async function completeOutboxEvent(id: string, now = new Date()) {
  const result = await prisma.outboxEvent.updateMany({
    where: { id, status: OutboxStatus.PROCESSING },
    data: { status: OutboxStatus.COMPLETED, lockedAt: null, processedAt: now, lastError: null },
  });
  return result.count === 1;
}

export async function failOutboxEvent(id: string, error: unknown, now = new Date(), maxAttempts = 10) {
  const event = await prisma.outboxEvent.findUnique({ where: { id }, select: { attempts: true, status: true } });
  if (!event || event.status !== OutboxStatus.PROCESSING) return false;
  // Event payloads can include business and contact context. Never persist or
  // log a thrown message verbatim because provider and validation errors may
  // echo that context back to us.
  const message = redactOutboxError(error);
  const retry = event.attempts < maxAttempts;
  const backoffMs = Math.min(60 * 60 * 1000, 2 ** Math.max(0, event.attempts - 1) * 1000);
  const result = await prisma.outboxEvent.updateMany({
    where: { id, status: OutboxStatus.PROCESSING },
    data: {
      status: retry ? OutboxStatus.PENDING : OutboxStatus.FAILED,
      lockedAt: null,
      availableAt: retry ? new Date(now.getTime() + backoffMs) : now,
      lastError: message.slice(0, 2_000),
    },
  });
  return result.count === 1;
}

export function redactOutboxError(error: unknown) {
  if (error instanceof Error && /^[A-Za-z][A-Za-z0-9_]*$/.test(error.name)) {
    return `Outbox handler failed (${error.name})`;
  }
  return "Outbox handler failed";
}

/** Re-enable a terminal event only through an authenticated operations route. */
export async function requeueFailedOutboxEvent(id: string, now = new Date()) {
  const result = await prisma.outboxEvent.updateMany({
    where: { id, status: OutboxStatus.FAILED },
    data: {
      status: OutboxStatus.PENDING,
      attempts: 0,
      availableAt: now,
      lockedAt: null,
      processedAt: null,
      lastError: null,
    },
  });
  return result.count === 1;
}

export async function processOutboxBatch(
  handler: (event: Awaited<ReturnType<typeof claimOutboxBatch>>[number]) => Promise<void>,
  limit = 25,
) {
  const events = await claimOutboxBatch(limit);
  let completed = 0;
  let failed = 0;
  for (const event of events) {
    try {
      await handler(event);
      if (await completeOutboxEvent(event.id)) completed += 1;
    } catch (error) {
      if (await failOutboxEvent(event.id, error)) failed += 1;
    }
  }
  return { claimed: events.length, completed, failed };
}

export async function purgeExpiredIngestReplays(now = new Date()) {
  const result = await prisma.ingestReplay.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}
