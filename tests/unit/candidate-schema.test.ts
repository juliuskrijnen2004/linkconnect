import { describe, expect, it } from "vitest";
import { candidateIngestSchema } from "@/lib/candidates";

const valid = { sourceWebsite: "https://werkenindetechniek.nl", externalCandidateId: "candidate-1", firstName: "Sam", lastName: "Jansen", email: "sam@example.nl", postcode: "5611AA", city: "Eindhoven", region: "Noord-Brabant", jobCategory: "Elektromonteur", desiredRole: "Elektromonteur", createdAt: new Date("2026-10-01T10:00:00Z"), consent: { consentGiven: true, consentTextVersion: "2026-10", privacyPolicyVersion: "2026-10", consentTimestamp: new Date("2026-10-01T09:00:00Z"), sourceWebsite: "https://werkenindetechniek.nl" } };
describe("candidate ingest schema", () => {
  it("accepts a consented candidate with contact data", () => expect(candidateIngestSchema.parse(valid).jobCategory).toBe("Elektromonteur"));
  it("requires a reachable contact method", () => expect(() => candidateIngestSchema.parse({ ...valid, email: undefined, phone: undefined })).toThrow());
  it("rejects consent captured after the candidate", () => expect(() => candidateIngestSchema.parse({ ...valid, consent: { ...valid.consent, consentTimestamp: new Date("2026-10-02T09:00:00Z") } })).toThrow());
});
