import { z } from "zod";

import { reassignAllocation } from "@/lib/allocations";
import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";

const schema = z.object({ targetCompanyId: z.string().uuid(), targetPricingRuleId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const { id } = await params;
    const input = schema.parse(await request.json());
    return Response.json({ allocation: await reassignAllocation({ allocationId: z.string().uuid().parse(id), actorUserId: session.userId, ...input }) });
  } catch (error) {
    return errorResponse(error);
  }
}
