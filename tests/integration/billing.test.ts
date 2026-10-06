import { beforeEach, describe, expect, it, vi } from "vitest";

const billingMocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findMany: vi.fn(),
  findOpportunityAllocations: vi.fn(),
  findInvoice: vi.fn(),
  createInvoice: vi.fn(),
  updateMany: vi.fn(),
  updateOpportunityAllocations: vi.fn(),
  createAuditLog: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: billingMocks.transaction,
  },
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(),
}));

import { createInvoiceDraft } from "@/lib/billing";

const periodStart = new Date("2026-09-01T00:00:00.000Z");
const periodEnd = new Date("2026-10-01T00:00:00.000Z");

describe("invoice draft flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const tx = {
      $queryRaw: billingMocks.queryRaw,
      allocation: {
        findMany: billingMocks.findMany,
        updateMany: billingMocks.updateMany,
      },
      opportunityAllocation: { findMany: billingMocks.findOpportunityAllocations, updateMany: billingMocks.updateOpportunityAllocations },
      invoice: { create: billingMocks.createInvoice, findUnique: billingMocks.findInvoice },
      auditLog: { create: billingMocks.createAuditLog },
    };
    billingMocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
    billingMocks.queryRaw.mockResolvedValue([]);
    billingMocks.findInvoice.mockResolvedValue(null);
    billingMocks.findMany.mockResolvedValue([
      { id: "allocation-1", currency: "EUR", priceCents: 2500, acceptedAt: new Date("2026-09-04") },
      { id: "allocation-2", currency: "EUR", priceCents: 3500, acceptedAt: new Date("2026-09-05") },
    ]);
    billingMocks.findOpportunityAllocations.mockResolvedValue([]);
    billingMocks.createInvoice.mockResolvedValue({ id: "invoice-1", lines: [] });
    billingMocks.updateMany.mockResolvedValue({ count: 2 });
    billingMocks.updateOpportunityAllocations.mockResolvedValue({ count: 0 });
    billingMocks.createAuditLog.mockResolvedValue({ id: "audit-1" });
  });

  it("creates immutable invoice lines and marks the selected allocations invoiced", async () => {
    const invoice = await createInvoiceDraft({
      companyId: "company-1",
      periodStart,
      periodEnd,
    });
    const createInput = billingMocks.createInvoice.mock.calls[0][0].data;

    expect(invoice).toEqual({ id: "invoice-1", lines: [] });
    expect(createInput).toMatchObject({
      companyId: "company-1",
      currency: "EUR",
      subtotalCents: 6000,
      totalCents: 6000,
      periodStart,
      periodEnd,
    });
    expect(createInput.lines.create).toEqual([
      {
        allocationId: "allocation-1",
        description: "Lead allocation allocation-1",
        unitCents: 2500,
        totalCents: 2500,
      },
      {
        allocationId: "allocation-2",
        description: "Lead allocation allocation-2",
        unitCents: 3500,
        totalCents: 3500,
      },
    ]);
    expect(billingMocks.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["allocation-1", "allocation-2"] } },
      data: { status: "INVOICED" },
    });
    expect(billingMocks.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "invoice.drafted",
        metadata: { allocationCount: 2, salesLeadCount: 2, candidateCount: 0, subtotalCents: 6000, currency: "EUR" },
      }),
    }));
  });

  it("refuses to create an invoice for mixed currencies", async () => {
    billingMocks.findMany.mockResolvedValue([
      { id: "allocation-1", currency: "EUR", priceCents: 2500, acceptedAt: new Date("2026-09-04") },
      { id: "allocation-2", currency: "GBP", priceCents: 3500, acceptedAt: new Date("2026-09-05") },
    ]);

    await expect(createInvoiceDraft({ companyId: "company-1", periodStart, periodEnd }))
      .rejects.toThrow("An invoice may contain only one currency");
    expect(billingMocks.createInvoice).not.toHaveBeenCalled();
    expect(billingMocks.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an empty billing period", async () => {
    billingMocks.findMany.mockResolvedValue([]);

    await expect(createInvoiceDraft({ companyId: "company-1", periodStart, periodEnd }))
      .rejects.toThrow("No uninvoiced accepted allocations for this period");
  });
});
