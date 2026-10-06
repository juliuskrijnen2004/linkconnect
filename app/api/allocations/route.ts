import { z } from "zod";

import { requireCompanySession } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { tenantScope } from "@/lib/tenant";

const querySchema = z.object({ companyId: z.string().uuid().optional() });

export async function GET(request: Request) {
  try {
    const session = await requireCompanySession();
    const query = querySchema.parse({
      companyId: new URL(request.url).searchParams.get("companyId") ?? undefined,
    });
    const scope = tenantScope(session, query.companyId);
    const allocations = await prisma.allocation.findMany({
      where: scope,
      orderBy: { allocatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        score: true,
        priceCents: true,
        currency: true,
        allocatedAt: true,
        lead: { select: { id: true, category: true, postalCode: true, contact: true } },
      },
    });
    return Response.json({ allocations });
  } catch (error) {
    return errorResponse(error);
  }
}
