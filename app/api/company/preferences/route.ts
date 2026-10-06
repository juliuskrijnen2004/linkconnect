import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { ConflictError, errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ categories: z.string().min(1), regions: z.string().min(1), minimumWeeklyLeads: z.coerce.number().int().min(2).max(100), leadDeliveryActive: z.string().optional() });
const slugify = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireCompanySession();
    if (!session.companyId) return Response.json({ error: "Company required" }, { status: 403 });
    const input = schema.parse(Object.fromEntries(await request.formData()));
    const categoryNames = input.categories.split(",").map((value) => value.trim()).filter(Boolean);
    const regions = input.regions.split(",").map((value) => value.trim()).filter(Boolean);
    const deliveryActive = input.leadDeliveryActive === "on";
    await prisma.$transaction(async (tx) => {
      const [company, mandate] = await Promise.all([
        tx.company.findUniqueOrThrow({ where: { id: session.companyId! }, select: { status: true } }),
        tx.sepaMandate.findFirst({ where: { companyId: session.companyId!, status: "ACTIVE" }, select: { id: true } }),
      ]);
      if (deliveryActive && (company.status !== "ACTIVE" || !mandate)) throw new ConflictError("Lead delivery requires an active account and SEPA mandate");
      await tx.company.update({ where: { id: session.companyId! }, data: { minimumWeeklyLeads: input.minimumWeeklyLeads, leadDeliveryActive: deliveryActive } });
      await tx.companyLeadPreference.updateMany({ where: { companyId: session.companyId! }, data: { active: false } });
      for (const name of categoryNames) {
        const slug = slugify(name);
        const category = await tx.leadCategory.upsert({ where: { slug }, update: {}, create: { slug, name, defaultPriceCents: 0, active: false } });
        await tx.companyLeadPreference.upsert({ where: { companyId_preferenceKey: { companyId: session.companyId!, preferenceKey: `category:${slug}` } }, update: { active: true, categoryId: category.id }, create: { companyId: session.companyId!, categoryId: category.id, preferenceKey: `category:${slug}` } });
      }
      await tx.companyRegion.updateMany({ where: { companyId: session.companyId! }, data: { active: false } });
      for (const region of regions) await tx.companyRegion.upsert({ where: { companyId_region: { companyId: session.companyId!, region } }, update: { active: true, radiusKm: null }, create: { companyId: session.companyId!, region, radiusKm: null } });
      await tx.auditLog.create({ data: { companyId: session.companyId!, actorUserId: session.userId, actorType: "USER", action: "company.delivery_preferences_updated", entityType: "Company", entityId: session.companyId!, metadata: { deliveryActive, minimumWeeklyLeads: input.minimumWeeklyLeads, categoryCount: categoryNames.length, regionCount: regions.length } } });
    });
    return NextResponse.redirect(new URL("/dashboard/voorkeuren?saved=1", request.url), 303);
  } catch (error) {
    return errorResponse(error);
  }
}
