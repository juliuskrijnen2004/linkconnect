import { AllocationStatus, OpportunityType } from "@prisma/client";
import { NotFoundError } from "@/lib/http";
import { companyRegionMatches, limitCandidatesToBuyerCapacity } from "@/lib/matching";
import { prisma } from "@/lib/prisma";

export type CandidateMatch = { companyId: string; pricingRuleId: string; score: number; priceCents: number; currency: string };
const active = [AllocationStatus.PENDING, AllocationStatus.ACCEPTED, AllocationStatus.INVOICED, AllocationStatus.DISPUTED];
function weekStart() { const date = new Date(); date.setUTCHours(0, 0, 0, 0); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); return date; }
function equals(left: string | null | undefined, right: string | null | undefined) { return Boolean(left && right && left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0); }

export function candidatePreferenceMatches(preference: { category: string; desiredRole: string | null; region: string | null; postalPrefixes: string[]; minimumHours: number | null; maximumHours: number | null; minimumExperienceYears: number | null; driversLicenseRequired: boolean; exclusiveOnly: boolean; maxPriceCents: number | null }, candidate: { category: string; service: string | null; region: string | null; postalCode: string; availableHours: number | null; experienceYears: number | null; driversLicense: boolean; exclusive: boolean }, priceCents: number) {
  if (!equals(preference.category, candidate.category) || (preference.desiredRole && !equals(preference.desiredRole, candidate.service))) return false;
  if (preference.region && preference.region !== candidate.region && !preference.postalPrefixes.some((prefix) => candidate.postalCode.startsWith(prefix))) return false;
  if (preference.postalPrefixes.length && !preference.postalPrefixes.some((prefix) => candidate.postalCode.startsWith(prefix))) return false;
  if (preference.minimumHours != null && (candidate.availableHours ?? 0) < preference.minimumHours) return false;
  if (preference.maximumHours != null && candidate.availableHours != null && candidate.availableHours > preference.maximumHours) return false;
  if (preference.minimumExperienceYears != null && (candidate.experienceYears ?? 0) < preference.minimumExperienceYears) return false;
  return !(preference.driversLicenseRequired && !candidate.driversLicense) && !(preference.exclusiveOnly && !candidate.exclusive) && !(preference.maxPriceCents != null && priceCents > preference.maxPriceCents);
}

export async function matchCandidateOpportunity(opportunityId: string): Promise<CandidateMatch[]> {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: opportunityId }, include: { candidateProfile: true } });
  if (!opportunity || opportunity.type !== OpportunityType.CANDIDATE || !opportunity.candidateProfile) throw new NotFoundError("Candidate not found");
  const count = await prisma.opportunityAllocation.count({ where: { opportunityId, status: { in: active } } }); const capacity = opportunity.maxBuyersPerOpportunity - count; if (capacity <= 0) return [];
  const rules = await prisma.pricingRule.findMany({ where: { active: true, opportunityType: OpportunityType.CANDIDATE, category: opportunity.category, company: { status: "ACTIVE", candidateDeliveryActive: true, mandates: { some: { status: "ACTIVE" } }, candidatePreferences: { some: { active: true, category: opportunity.category } } } }, include: { company: { select: { candidatePreferences: { where: { active: true, category: opportunity.category } }, regions: { where: { active: true } } } } }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] });
  const weekly = await prisma.opportunityAllocation.groupBy({ by: ["companyId"], where: { companyId: { in: rules.map((rule) => rule.companyId) }, allocatedAt: { gte: weekStart() }, status: { in: active } }, _count: { _all: true } }); const delivered = new Map(weekly.map((item) => [item.companyId, item._count._all]));
  const unique = new Map<string, CandidateMatch>();
  for (const rule of rules) {
    const priceCents = opportunity.exclusive ? (rule.exclusivePriceCents ?? rule.priceCents) : (rule.sharedPriceCents ?? rule.priceCents);
    if (rule.region && rule.region !== opportunity.region && !rule.postalPrefixes.some((prefix) => opportunity.postalCode.startsWith(prefix))) continue;
    if (rule.postalPrefixes.length && !rule.postalPrefixes.some((prefix) => opportunity.postalCode.startsWith(prefix))) continue;
    if (!rule.company.regions.some((region) => companyRegionMatches(region, opportunity))) continue;
    const preferences = rule.company.candidatePreferences.filter((preference) => candidatePreferenceMatches(preference, { category: opportunity.category, service: opportunity.service, region: opportunity.region, postalCode: opportunity.postalCode, availableHours: opportunity.candidateProfile!.availableHours, experienceYears: opportunity.candidateProfile!.experienceYears, driversLicense: opportunity.candidateProfile!.driversLicense, exclusive: opportunity.exclusive }, priceCents));
    if (!preferences.length || unique.has(rule.companyId)) continue;
    const max = preferences.reduce<number | null>((limit, preference) => preference.maxWeeklyCandidates == null ? limit : limit == null ? preference.maxWeeklyCandidates : Math.min(limit, preference.maxWeeklyCandidates), null);
    if (max != null && (delivered.get(rule.companyId) ?? 0) >= max) continue;
    unique.set(rule.companyId, { companyId: rule.companyId, pricingRuleId: rule.id, score: 80 + Math.min(rule.priority, 20), priceCents, currency: rule.currency });
  }
  return limitCandidatesToBuyerCapacity([...unique.values()], capacity);
}
