import { notFound } from "next/navigation";
import { requireCompanySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function companyContext() {
  const session = await requireCompanySession();
  if (!session.companyId) notFound();
  return { session, companyId: session.companyId };
}

export async function getDashboardData() {
  const { companyId, session } = await companyContext();
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [company, weekCount, monthCount, monthCost, recent, openInvoices, mandate] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { regions: { where: { active: true } }, preferences: { where: { active: true }, include: { category: true, service: true } } } }),
    prisma.allocation.count({ where: { companyId, allocatedAt: { gte: weekStart } } }),
    prisma.allocation.count({ where: { companyId, allocatedAt: { gte: monthStart } } }),
    prisma.allocation.aggregate({ where: { companyId, allocatedAt: { gte: monthStart }, status: { in: ["ACCEPTED", "INVOICED"] } }, _sum: { priceCents: true } }),
    prisma.allocation.findMany({ where: { companyId }, orderBy: { allocatedAt: "desc" }, take: 5, include: { lead: true } }),
    prisma.invoice.aggregate({ where: { companyId, status: "OPEN" }, _sum: { totalCents: true } }),
    prisma.sepaMandate.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } }),
  ]);
  return { session, company, weekCount, monthCount, monthCostCents: monthCost._sum.priceCents ?? 0, recent, openCents: openInvoices._sum.totalCents ?? 0, mandate };
}

export async function getLeads() { const { companyId } = await companyContext(); return prisma.allocation.findMany({ where: { companyId }, orderBy: { allocatedAt: "desc" }, include: { lead: true } }); }
export async function getCandidates() { const { companyId } = await companyContext(); return prisma.opportunityAllocation.findMany({ where: { companyId, opportunity: { type: "CANDIDATE" } }, orderBy: { allocatedAt: "desc" }, include: { opportunity: { include: { candidateProfile: true } } } }); }
export async function getCandidateDetail(opportunityId: string) { const { companyId } = await companyContext(); const item = await prisma.opportunityAllocation.findFirst({ where: { companyId, opportunityId, opportunity: { type: "CANDIDATE" } }, include: { opportunity: { include: { candidateProfile: true } } } }); if (!item) notFound(); if (!item.viewedAt) await prisma.opportunityAllocation.update({ where: { id: item.id }, data: { viewedAt: new Date() } }); return item; }
export async function getLeadDetail(leadId: string) { const { companyId } = await companyContext(); const item = await prisma.allocation.findFirst({ where: { companyId, leadId }, include: { lead: true, disputes: { orderBy: { createdAt: "desc" } } } }); if (!item) notFound(); if (!item.viewedAt) await prisma.allocation.update({ where: { id: item.id }, data: { viewedAt: new Date(), companyStatus: item.companyStatus === "NEW" ? "VIEWED" : item.companyStatus } }); return item; }
export async function getInvoices() { const { companyId } = await companyContext(); return prisma.invoice.findMany({ where: { companyId }, include: { lines: true }, orderBy: { periodEnd: "desc" } }); }
export async function getPayments() { const { companyId } = await companyContext(); return Promise.all([prisma.payment.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }), prisma.sepaMandate.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } })]); }
export async function getCompanyProfile() { const { companyId } = await companyContext(); return prisma.company.findUniqueOrThrow({ where: { id: companyId }, include: { regions: { where: { active: true } }, preferences: { where: { active: true }, include: { category: true } } } }); }
