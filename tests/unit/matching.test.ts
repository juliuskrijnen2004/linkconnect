import { describe, expect, it } from "vitest";

import { companyRegionMatches, limitCandidatesToBuyerCapacity, servicePreferenceMatches } from "@/lib/matching";
import { tinyHouseMatchingFixture } from "@/tests/fixtures/matching";

describe("company region matching", () => {
  it("matches an explicitly selected region without postcode prefixes", () => {
    expect(companyRegionMatches(
      { region: "Noord-Holland", postalPrefixes: [] },
      { region: "Noord-Holland", postalCode: "1012AB" },
    )).toBe(true);
  });

  it("does not treat an empty postcode list as nationwide coverage", () => {
    expect(companyRegionMatches(
      { region: "Noord-Holland", postalPrefixes: [] },
      { region: "Gelderland", postalCode: "6811AA" },
    )).toBe(false);
  });

  it("allows an explicit postcode prefix to cross a named-region boundary", () => {
    expect(companyRegionMatches(
      { region: "Noord-Holland", postalPrefixes: ["68"] },
      { region: "Gelderland", postalCode: "6811AA" },
    )).toBe(true);
  });
});

describe("service preference matching", () => {
  it("lets a category-wide preference match a service within the same category", () => {
    expect(servicePreferenceMatches(tinyHouseMatchingFixture.genericPreference.service, tinyHouseMatchingFixture.lead.service)).toBe(true);
  });

  it("requires a service-specific preference to match the requested service", () => {
    expect(servicePreferenceMatches(tinyHouseMatchingFixture.matchingServicePreference.service, tinyHouseMatchingFixture.lead.service)).toBe(true);
    expect(servicePreferenceMatches(tinyHouseMatchingFixture.matchingServicePreference.service, tinyHouseMatchingFixture.nonMatchingServicePreference.service)).toBe(false);
  });

  it("compares service names without making case a source of missed matches", () => {
    expect(servicePreferenceMatches("Tiny house kopen", "tiny house kopen")).toBe(true);
  });
});

describe("buyer capacity", () => {
  it("returns no more candidates than the remaining lead capacity", () => {
    const candidates = ["buyer-1", "buyer-2", "buyer-3"];
    expect(limitCandidatesToBuyerCapacity(candidates, 2)).toEqual(["buyer-1", "buyer-2"]);
  });

  it("does not return candidates when prior allocations filled capacity", () => {
    expect(limitCandidatesToBuyerCapacity(["buyer-1"], 0)).toEqual([]);
  });
});
