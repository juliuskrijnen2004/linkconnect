import { describe, expect, it } from "vitest";
import { candidatePreferenceMatches } from "@/lib/candidate-matching";
const candidate = { category: "Elektromonteur", service: "Elektromonteur", region: "Noord-Brabant", postalCode: "5611AA", availableHours: 36, experienceYears: 2, driversLicense: true, exclusive: false };
const preference = { category: "Elektromonteur", desiredRole: "Elektromonteur", region: "Noord-Brabant", postalPrefixes: ["56"], minimumHours: 32, maximumHours: 40, minimumExperienceYears: 1, driversLicenseRequired: true, exclusiveOnly: false, maxPriceCents: 10000 };
describe("candidate matching", () => {
  it("matches a suitable candidate", () => expect(candidatePreferenceMatches(preference, candidate, 4900)).toBe(true));
  it("rejects an insufficient-hours candidate", () => expect(candidatePreferenceMatches(preference, { ...candidate, availableHours: 24 }, 4900)).toBe(false));
  it("rejects a candidate without a required driving licence", () => expect(candidatePreferenceMatches(preference, { ...candidate, driversLicense: false }, 4900)).toBe(false));
  it("rejects the wrong region", () => expect(candidatePreferenceMatches(preference, { ...candidate, region: "Gelderland", postalCode: "6811AA" }, 4900)).toBe(false));
});
