import { describe, expect, it } from "vitest";

import { clampRecipientsToSourcePolicy, leadIngestSchema, slugifyLeadValue, sourceWebsiteMatchesDomain } from "@/lib/leads";

const baseLead = {
  sourceWebsite: "https://source.example",
  externalLeadId: "source-123",
  category: "Zonnepanelen",
  service: "Advies",
  customerName: "Ada Lovelace",
  email: "ADA@example.com",
  postcode: " 1012 ab ",
  city: "Amsterdam",
  region: "Noord-Holland",
  description: "Klant zoekt een adviesgesprek.",
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  consent: {
    accepted: true,
    capturedAt: new Date(Date.now() - 120_000).toISOString(),
    version: "2026-10-01",
    source: "website-form",
  },
};

describe("lead ingest schema", () => {
  it("normalizes lead values and applies safe defaults", () => {
    const parsed = leadIngestSchema.parse(baseLead);

    expect(parsed.postcode).toBe("1012 AB");
    expect(parsed.metadata).toEqual({});
    expect(parsed.maxBuyersPerLead).toBe(1);
    expect(parsed.consentAt).toBeUndefined();
  });

  it("accepts a phone-only lead and retains bounded metadata", () => {
    const parsed = leadIngestSchema.parse({
      ...baseLead,
      email: undefined,
      phone: "+31 20 123 4567",
      metadata: { campaign: "spring", score: 4 },
      maxBuyersPerLead: 3,
    });

    expect(parsed.email).toBeUndefined();
    expect(parsed.phone).toBe("+31 20 123 4567");
    expect(parsed.metadata).toEqual({ campaign: "spring", score: 4 });
    expect(parsed.maxBuyersPerLead).toBe(3);
  });

  it("requires at least one customer contact method", () => {
    expect(() => leadIngestSchema.parse({ ...baseLead, email: undefined })).toThrow(
      "lead requires an email or phone number",
    );
  });

  it("rejects future timestamps and out-of-range buyer counts", () => {
    expect(() => leadIngestSchema.parse({
      ...baseLead,
      createdAt: new Date(Date.now() + 60_000).toISOString(),
    })).toThrow();
    expect(() => leadIngestSchema.parse({ ...baseLead, maxBuyersPerLead: 21 })).toThrow();
  });

  it("records structured consent evidence and rejects consent captured in the future", () => {
    const consent = {
      accepted: true,
      capturedAt: new Date(Date.now() - 120_000).toISOString(),
      version: "2026-10-01",
      source: "website-form",
      proofHash: "a".repeat(64),
      marketingAllowed: false,
      metadata: { form: "contact" },
    };
    expect(leadIngestSchema.parse({ ...baseLead, consent }).consent).toMatchObject({
      accepted: true,
      version: "2026-10-01",
      source: "website-form",
      proofHash: "a".repeat(64),
    });
    expect(() => leadIngestSchema.parse({
      ...baseLead,
      consent: { ...consent, capturedAt: new Date(Date.now() + 60_000).toISOString() },
    })).toThrow();
  });

  it("normalizes source policy values and accepts only the configured domain", () => {
    expect(slugifyLeadValue(" Zonnepanelen plaatsen ")).toBe("zonnepanelen-plaatsen");
    expect(sourceWebsiteMatchesDomain("https://www.source.example/forms", "source.example")).toBe(true);
    expect(sourceWebsiteMatchesDomain("https://untrusted.example/forms", "source.example")).toBe(false);
  });

  it("keeps buyer distribution under the server-owned lead-source cap", () => {
    expect(clampRecipientsToSourcePolicy(3, 1)).toBe(1);
    expect(clampRecipientsToSourcePolicy(1, 3)).toBe(1);
  });
});
