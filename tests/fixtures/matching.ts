export const tinyHouseMatchingFixture = {
  lead: {
    category: "Tiny Houses",
    service: "Tiny house op maat",
    postalCode: "5611AB",
    region: "Noord-Brabant",
    maxBuyersPerLead: 2,
  },
  matchingRegion: {
    region: "Noord-Brabant",
    postalPrefixes: ["56"],
  },
  nonMatchingRegion: {
    region: "Gelderland",
    postalPrefixes: ["68"],
  },
  genericPreference: {
    service: null,
  },
  matchingServicePreference: {
    service: "Tiny house op maat",
  },
  nonMatchingServicePreference: {
    service: "Prefab tiny house",
  },
} as const;
