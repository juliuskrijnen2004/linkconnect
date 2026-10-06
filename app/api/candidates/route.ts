import { authenticateIngestRequest, CANDIDATE_WRITE_SCOPE } from "@/lib/api-keys";
import { candidateIngestSchema, ingestCandidate } from "@/lib/candidates";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
const MAX_BODY_BYTES = 1_000_000;
export async function POST(request: Request) { try {
  const rawBody = await request.text(); if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 });
  const apiKey = await authenticateIngestRequest(request.headers, rawBody, CANDIDATE_WRITE_SCOPE); if (!apiKey?.leadSourceId) return Response.json({ error: "Invalid API key or signature" }, { status: 401 });
  await enforceRateLimit(request, `candidate-ingest:${apiKey.id}`, 60, 60_000);
  let body: unknown; try { body = JSON.parse(rawBody); } catch { return Response.json({ error: "Malformed JSON" }, { status: 400 }); }
  const candidate = candidateIngestSchema.parse(body);
  const result = await ingestCandidate({ companyId: apiKey.companyId, apiKeyId: apiKey.id, leadSourceId: apiKey.leadSourceId, candidate, requestId: request.headers.get("x-request-id")?.slice(0, 128), replay: "replay" in apiKey ? apiKey.replay : undefined });
  return Response.json({ ...result, allocations: result.allocationIds }, { status: result.duplicate ? 200 : 201 });
} catch (error) { return errorResponse(error); } }
