import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  parse: vi.fn((value: unknown) => value),
  ingest: vi.fn(),
  match: vi.fn(),
  allocateCandidates: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/api-keys", () => ({
  authenticateIngestRequest: routeMocks.authenticate,
}));
vi.mock("@/lib/leads", () => ({
  ingestLead: routeMocks.ingest,
  leadIngestSchema: { parse: routeMocks.parse },
}));
vi.mock("@/lib/matching", () => ({
  matchLead: routeMocks.match,
}));
vi.mock("@/lib/allocations", () => ({
  allocateLeadCandidates: routeMocks.allocateCandidates,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: routeMocks.rateLimit,
}));

import { POST } from "@/app/api/leads/route";

const payload = {
  sourceWebsite: "https://source.example",
  externalLeadId: "source-123",
  category: "Zonnepanelen",
  service: "Advies",
  customerName: "Ada Lovelace",
  email: "ada@example.com",
  postcode: "1012 AB",
  city: "Amsterdam",
  region: "Noord-Holland",
  description: "Klant zoekt advies.",
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  consent: {
    accepted: true,
    capturedAt: new Date(Date.now() - 120_000).toISOString(),
    version: "2026-10-01",
    source: "website-form",
  },
  maxBuyersPerLead: 2,
};

function request(body: string | object, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.authenticate.mockResolvedValue({ id: "api-key-1", companyId: "source-company", leadSourceId: "source-1" });
    routeMocks.ingest.mockResolvedValue({ leadId: "lead-1", duplicate: false, allocationIds: [] });
    routeMocks.rateLimit.mockResolvedValue(undefined);
    routeMocks.match.mockResolvedValue([
      { companyId: "buyer-1", pricingRuleId: "rule-1", score: 100 },
      { companyId: "buyer-2", pricingRuleId: "rule-2", score: 90 },
      { companyId: "buyer-3", pricingRuleId: "rule-3", score: 80 },
    ]);
    routeMocks.allocateCandidates.mockResolvedValue([{ id: "allocation-buyer-2" }]);
  });

  it("returns 401 before parsing when the ingest credential is invalid", async () => {
    routeMocks.authenticate.mockResolvedValue(null);

    const response = await POST(request(payload, { "x-api-key": "invalid" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid API key or signature" });
    expect(routeMocks.ingest).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON after authenticating the source", async () => {
    const response = await POST(request("not-json", { "x-api-key": "lc_live_source" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Malformed JSON" });
    expect(routeMocks.ingest).not.toHaveBeenCalled();
  });

  it("enqueues ingestion without running matching inline", async () => {
    const response = await POST(request(payload, {
      "x-api-key": "lc_live_source",
      "x-request-id": "request-123",
    }));

    expect(response.status).toBe(201);
    expect(routeMocks.ingest).toHaveBeenCalledWith(expect.objectContaining({
      companyId: "source-company",
      apiKeyId: "api-key-1",
      leadSourceId: "source-1",
      requestId: "request-123",
    }));
    expect(routeMocks.rateLimit).toHaveBeenCalledWith(expect.any(Request), "lead-ingest:api-key-1", 120, 60_000);
    expect(routeMocks.match).not.toHaveBeenCalled();
    expect(routeMocks.allocateCandidates).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      leadId: "lead-1",
      duplicate: false,
      allocationIds: [],
      allocations: [],
    });
  });

  it("returns existing allocations for a duplicate without reprocessing it", async () => {
    routeMocks.ingest.mockResolvedValue({ leadId: "lead-1", duplicate: true, allocationIds: ["allocation-1"] });

    const response = await POST(request(payload, { "x-api-key": "lc_live_source" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      leadId: "lead-1",
      duplicate: true,
      allocationIds: ["allocation-1"],
      allocations: ["allocation-1"],
    });
    expect(routeMocks.match).not.toHaveBeenCalled();
    expect(routeMocks.allocateCandidates).not.toHaveBeenCalled();
  });

  it("rejects a payload above the one-megabyte limit", async () => {
    const response = await POST(request("x".repeat(1_000_001), { "x-api-key": "lc_live_source" }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Payload too large" });
    expect(routeMocks.authenticate).not.toHaveBeenCalled();
  });
});
