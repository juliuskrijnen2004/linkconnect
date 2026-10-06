import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { openOpportunityDispute } from "@/lib/disputes";
import { errorResponse } from "@/lib/http";
import { requireTenantCompanyId } from "@/lib/tenant";

const disputeSchema = z.object({
  companyId: z.string().uuid().optional(),
  reason: z.string().trim().min(5).max(500),
  notes: z.string().trim().max(5_000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ allocationId: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = await requireCompanySession();
    const { allocationId } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
    const { companyId: requestedCompanyId, ...disputeInput } = disputeSchema.parse(payload);
    const companyId = requireTenantCompanyId(session, requestedCompanyId);
    const dispute = await openOpportunityDispute({
      companyId,
      opportunityAllocationId: z.string().uuid().parse(allocationId),
      openedByUserId: session.userId,
      ...disputeInput,
    });
    return contentType.includes("application/json")
      ? Response.json({ dispute }, { status: 201 })
      : NextResponse.redirect(new URL("/dashboard/kandidaten?dispute=opened", request.url), 303);
  } catch (error) {
    return errorResponse(error);
  }
}
