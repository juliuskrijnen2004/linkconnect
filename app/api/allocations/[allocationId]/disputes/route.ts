import { z } from "zod";
import { NextResponse } from "next/server";

import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { openDispute } from "@/lib/disputes";
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
    const payload = contentType.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
    const { companyId: requestedCompanyId, ...disputeInput } = disputeSchema.parse(payload);
    const companyId = requireTenantCompanyId(session, requestedCompanyId);
    const dispute = await openDispute({
      companyId,
      allocationId: z.string().uuid().parse(allocationId),
      openedByUserId: session.userId,
      ...disputeInput,
    });
    return contentType.includes("application/json") ? Response.json({ dispute }, { status: 201 }) : NextResponse.redirect(new URL("/dashboard/leads?dispute=opened", request.url), 303);
  } catch (error) {
    return errorResponse(error);
  }
}
