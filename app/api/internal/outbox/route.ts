import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { errorResponse } from "@/lib/http";
import { getServerEnv } from "@/lib/env";
import { processOutboxBatch } from "@/lib/outbox";
import { matchLead } from "@/lib/matching";
import { allocateLeadCandidates } from "@/lib/allocations";
import { allocateCandidateCandidates } from "@/lib/candidate-allocations";
import { matchCandidateOpportunity } from "@/lib/candidate-matching";
import { COMPANY_EMAIL_OUTBOX_EVENT, sendCompanyEmail } from "@/lib/notifications";

export const runtime = "nodejs";

const leadIngestedPayload = z.object({
  leadId: z.string().uuid(),
});
const candidateIngestedPayload = z.object({ opportunityId: z.string().uuid() });
const companyEmailPayload = z.object({
  eventType: z.string().min(1).max(128),
  subject: z.string().min(1).max(200),
  text: z.string().min(1).max(10_000),
});

function hasValidCronSecret(request: Request, configuredSecret: string) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return false;
  const received = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(configuredSecret, "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function run(request: Request) {
  try {
    const { CRON_SECRET } = getServerEnv();
    if (!CRON_SECRET) return Response.json({ error: "Outbox worker is not configured" }, { status: 503 });
    if (!hasValidCronSecret(request, CRON_SECRET)) return Response.json({ error: "Authentication required" }, { status: 401 });

    const result = await processOutboxBatch(async (event) => {
      if (event.eventType === "lead.ingested") {
        const payload = leadIngestedPayload.parse(event.payload);
        const candidates = await matchLead(payload.leadId);
        await allocateLeadCandidates(payload.leadId, candidates);
        return;
      }
      if (event.eventType === "candidate.ingested") {
        const payload = candidateIngestedPayload.parse(event.payload);
        const candidates = await matchCandidateOpportunity(payload.opportunityId);
        await allocateCandidateCandidates(payload.opportunityId, candidates);
        return;
      }
      if (event.eventType === COMPANY_EMAIL_OUTBOX_EVENT) {
        if (!event.companyId) throw new Error("OutboxNotificationMissingCompany");
        const payload = companyEmailPayload.parse(event.payload);
        const delivery = await sendCompanyEmail({
          companyId: event.companyId,
          ...payload,
          // Resend receives this stable key on every retry, so a worker crash
          // between provider acceptance and outbox completion cannot duplicate mail.
          idempotencyKey: event.dedupeKey,
        });
        if (delivery.reason === "provider_error" || delivery.reason === "not_configured") {
          throw new Error("OutboxNotificationDeliveryUnavailable");
        }
        return;
      }
      throw new Error("UnsupportedOutboxEvent");
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
