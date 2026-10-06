import { describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  outboxEvent: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { enqueueOutboxEvent, failOutboxEvent, processOutboxBatch, requeueFailedOutboxEvent } from "@/lib/outbox";

describe("durable lead-ingest outbox", () => {
  it("uses a unique dedupe key when enqueueing an event", async () => {
    const tx = { outboxEvent: { upsert: vi.fn().mockResolvedValue({ id: "event-1" }) } };
    await enqueueOutboxEvent(tx as never, {
      dedupeKey: "lead.ingested:lead-1",
      eventType: "lead.ingested",
      aggregateType: "Lead",
      aggregateId: "00000000-0000-0000-0000-000000000001",
      companyId: "00000000-0000-0000-0000-000000000002",
      payload: { leadId: "00000000-0000-0000-0000-000000000001" },
    });

    expect(tx.outboxEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: "lead.ingested:lead-1" },
      update: {},
      create: expect.objectContaining({ eventType: "lead.ingested" }),
    }));
  });

  it("claims, handles, and completes a pending event", async () => {
    const event = {
      id: "event-1",
      eventType: "lead.ingested",
      payload: { leadId: "00000000-0000-0000-0000-000000000001" },
    };
    const tx = {
      outboxEvent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([event]),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "event-1" }]),
    };
    prismaMock.$transaction.mockImplementation(async (callback: (transaction: typeof tx) => unknown) => callback(tx));
    prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    const handled: string[] = [];
    const result = await processOutboxBatch(async (claimed) => {
      handled.push(claimed.id);
    });

    expect(handled).toEqual(["event-1"]);
    expect(prismaMock.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "event-1", status: "PROCESSING" },
    }));
    expect(result).toEqual({ claimed: 1, completed: 1, failed: 0 });
  });

  it("redacts failure messages before storing them for retry", async () => {
    prismaMock.outboxEvent.findUnique.mockResolvedValue({ attempts: 1, status: "PROCESSING" });
    prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    await expect(failOutboxEvent("event-1", new Error("email ada@example.com rejected: bearer token")))
      .resolves.toBe(true);

    expect(prismaMock.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lastError: "Outbox handler failed (Error)" }),
    }));
  });

  it("requeues only terminal failures and resets their retry lease", async () => {
    prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    await expect(requeueFailedOutboxEvent("event-1")).resolves.toBe(true);

    expect(prismaMock.outboxEvent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "event-1", status: "FAILED" },
      data: expect.objectContaining({ status: "PENDING", attempts: 0, lockedAt: null, lastError: null }),
    }));
  });
});
