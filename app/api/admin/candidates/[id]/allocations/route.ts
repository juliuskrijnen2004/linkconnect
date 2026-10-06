import { z } from "zod";

import { allocateCandidate } from "@/lib/candidate-allocations";
import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";

const schema = z.object({
  companyId: z.string().uuid(),
  pricingRuleId: z.string().uuid(),
  score: z.number().int().min(0).max(100).default(100),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await requireRole("ADMIN");
    const { id } = await params;
    const input = schema.parse(await request.json());
    const allocation = await allocateCandidate({
      opportunityId: z.string().uuid().parse(id),
      ...input,
      actorUserId: session.userId,
    });
    return Response.json({ allocation }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
