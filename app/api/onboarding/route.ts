import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ website: z.string().url().optional().or(z.literal("")), kvk: z.string().min(6).max(20), vat: z.string().min(6).max(32), categories: z.string().min(2), regions: z.string().min(2), termsAccepted: z.literal("yes"), termsVersion: z.string().min(1).max(40) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireCompanySession();
    if (!session.companyId) return Response.json({ error: "Company account required" }, { status: 403 });
    const input = schema.parse(Object.fromEntries(await request.formData()));
    const categoryNames = input.categories.split(",").map(v => v.trim()).filter(Boolean);
    const regions = input.regions.split(",").map(v => v.trim()).filter(Boolean);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await prisma.$transaction(async tx => {
      await tx.company.update({ where: { id: session.companyId! }, data: { website: input.website || null, kvkNumber: input.kvk, vatNumber: input.vat, minimumWeeklyLeads: 2, status: "PENDING", leadDeliveryActive: false } });
      for (const name of categoryNames) {
        const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const category = await tx.leadCategory.upsert({ where: { slug }, update: {}, create: { slug, name, defaultPriceCents: 0, active: false } });
        await tx.companyLeadPreference.upsert({ where: { companyId_preferenceKey: { companyId: session.companyId!, preferenceKey: `category:${slug}` } }, update: { active: true, categoryId: category.id }, create: { companyId: session.companyId!, categoryId: category.id, preferenceKey: `category:${slug}` } });
      }
      for (const region of regions) await tx.companyRegion.upsert({ where: { companyId_region: { companyId: session.companyId!, region } }, update: { active: true, radiusKm: null }, create: { companyId: session.companyId!, region, radiusKm: null } });
      await tx.companyAgreement.upsert({ where: { companyId_type_version: { companyId: session.companyId!, type: "LEAD_TERMS", version: input.termsVersion } }, update: {}, create: { companyId: session.companyId!, type: "LEAD_TERMS", version: input.termsVersion, acceptedAt: new Date(), ipHash: createHash("sha256").update(ip).digest("hex") } });
      await tx.sepaMandate.upsert({ where: { companyId_provider: { companyId: session.companyId!, provider: "stripe" } }, update: { status: "PENDING" }, create: { companyId: session.companyId!, provider: "stripe" } });
    });
    return NextResponse.redirect(new URL("/onboarding/sepa", request.url), 303);
  } catch (error) { return errorResponse(error); }
}
