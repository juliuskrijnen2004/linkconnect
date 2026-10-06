import { AllocationStatus, Lead, PricingRule } from "@prisma/client";

import { NotFoundError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export type MatchCandidate = {
  companyId: string;
  pricingRuleId: string;
  score: number;
  priceCents: number;
  currency: string;
};

type LeadForMatching = Pick<Lead, "category" | "service" | "postalCode">;

type ActivePreference = {
  maxWeeklyLeads: number | null;
  service: { name: string } | null;
};

function postalPrefixMatches(rule: PricingRule, postalCode: string) {
  return rule.postalPrefixes.length === 0 || rule.postalPrefixes.some((prefix) => postalCode.startsWith(prefix));
}

export function companyRegionMatches(
  region: { region: string; postalPrefixes: string[] },
  lead: { region: string | null; postalCode: string },
) {
  return region.region === lead.region
    || region.postalPrefixes.some((prefix) => lead.postalCode.startsWith(prefix));
}

export function servicePreferenceMatches(preferenceService: string | null, leadService: string | null) {
  // A category-only preference intentionally matches every service in that category.
  // A service-specific preference must never become a category-wide fallback.
  if (preferenceService == null) return true;
  return leadService != null && preferenceService.localeCompare(leadService, undefined, { sensitivity: "accent" }) === 0;
}

export function limitCandidatesToBuyerCapacity<T>(candidates: T[], remainingBuyerCapacity: number) {
  return candidates.slice(0, Math.max(0, remainingBuyerCapacity));
}

export function scoreLead(rule: PricingRule, lead: LeadForMatching, preferences: ActivePreference[]) {
  if (rule.category !== lead.category || !postalPrefixMatches(rule, lead.postalCode)) return 0;
  if (!preferences.some((preference) => servicePreferenceMatches(preference.service?.name ?? null, lead.service))) return 0;
  const hasServiceSpecificPreference = preferences.some((preference) => preference.service != null && servicePreferenceMatches(preference.service.name, lead.service));
  return 70 + (rule.postalPrefixes.length === 0 ? 10 : 30) + Math.min(rule.priority, 20) + (hasServiceSpecificPreference ? 10 : 0);
}

function currentWeekStart() {
  const result = new Date();
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result;
}

export async function matchLead(leadId: string): Promise<MatchCandidate[]> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, category: true, service: true, postalCode: true, region: true, maxBuyersPerLead: true },
  });
  if (!lead) throw new NotFoundError("Lead not found");
  const activeAllocationCount = await prisma.allocation.count({
    where: {
      leadId,
      status: { in: [AllocationStatus.PENDING, AllocationStatus.ACCEPTED, AllocationStatus.INVOICED, AllocationStatus.DISPUTED] },
    },
  });
  const remainingBuyerCapacity = Math.max(0, lead.maxBuyersPerLead - activeAllocationCount);
  if (remainingBuyerCapacity === 0) return [];
  const rules = await prisma.pricingRule.findMany({
    where: {
      active: true,
      category: lead.category,
      company: {
        status: "ACTIVE",
        leadDeliveryActive: true,
        mandates: { some: { status: "ACTIVE" } },
        preferences: {
          some: {
            active: true,
            category: { name: lead.category },
            OR: lead.service
              ? [{ serviceId: null }, { service: { name: { equals: lead.service, mode: "insensitive" } } }]
              : [{ serviceId: null }],
          },
        },
        regions: { some: { active: true } },
      },
    },
    include: {
      company: {
        select: {
          regions: { where: { active: true } },
          preferences: {
            where: {
              active: true,
              category: { name: lead.category },
              OR: lead.service
                ? [{ serviceId: null }, { service: { name: { equals: lead.service, mode: "insensitive" } } }]
                : [{ serviceId: null }],
            },
            select: { maxWeeklyLeads: true, service: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  const deliveredCounts = await prisma.allocation.groupBy({
    by: ["companyId"],
    where: { companyId: { in: rules.map((rule) => rule.companyId) }, allocatedAt: { gte: currentWeekStart() }, status: { in: ["PENDING", "ACCEPTED", "INVOICED", "DISPUTED"] } },
    _count: { _all: true },
  });
  const deliveredByCompany = new Map(deliveredCounts.map((item) => [item.companyId, item._count._all]));
  const unique = new Map<string, MatchCandidate>();
  for (const rule of rules) {
    const score = scoreLead(rule, lead, rule.company.preferences);
    if (score === 0 || unique.has(rule.companyId)) continue;
    const regionMatch = rule.company.regions.some((region) => companyRegionMatches(region, lead));
    if (!regionMatch) continue;
    const weeklyLimit = rule.company.preferences.reduce<number | null>((limit, preference) => preference.maxWeeklyLeads == null ? limit : limit == null ? preference.maxWeeklyLeads : Math.min(limit, preference.maxWeeklyLeads), null);
    if (weeklyLimit != null && (deliveredByCompany.get(rule.companyId) ?? 0) >= weeklyLimit) continue;
    unique.set(rule.companyId, { companyId: rule.companyId, pricingRuleId: rule.id, score, priceCents: rule.priceCents, currency: rule.currency });
  }
  return limitCandidatesToBuyerCapacity([...unique.values()], remainingBuyerCapacity);
}
