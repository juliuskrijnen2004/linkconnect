import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { requeueFailedOutboxEvent } from "@/lib/outbox";

export const runtime = "nodejs";

const requestSchema = z.object({ eventId: z.string().uuid() });

function hasValidCronSecret(request: Request, configuredSecret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const received = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(configuredSecret, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * Authenticated operations recovery for terminal outbox failures. Completed
 * events are deliberately immutable: replay-safe delivery is handled by the
 * provider idempotency key and allocation idempotency constraints.
 */
export async function POST(request: Request) {
  try {
    const { CRON_SECRET } = getServerEnv();
    if (!CRON_SECRET) return Response.json({ error: "Outbox worker is not configured" }, { status: 503 });
    if (!hasValidCronSecret(request, CRON_SECRET)) return Response.json({ error: "Authentication required" }, { status: 401 });
    const { eventId } = requestSchema.parse(await request.json());
    const requeued = await requeueFailedOutboxEvent(eventId);
    return Response.json({ requeued }, { status: requeued ? 200 : 409 });
  } catch (error) {
    return errorResponse(error);
  }
}
