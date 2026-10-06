import { ApiKeyStatus, Prisma } from "@prisma/client";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const MAX_SIGNATURE_AGE_MS = 5 * 60 * 1000;
export const LEAD_WRITE_SCOPE = "leads:write" as const;
export const CANDIDATE_WRITE_SCOPE = "candidates:write" as const;
const API_KEY_SCOPE_PATTERN = /^[a-z][a-z0-9:_-]{1,63}$/;

export type IngestReplayClaim = {
  replayKey: string;
  requestHash: string;
  expiresAt: Date;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createApiKeyMaterial() {
  const rawKey = `lc_live_${randomBytes(32).toString("base64url")}`;
  const hmacSecret = randomBytes(32).toString("base64url");
  return {
    rawKey,
    hmacSecret,
    prefix: rawKey.slice(0, 12),
    keyHash: sha256(rawKey),
  };
}

function normalizeScopes(scopes?: string[]) {
  const normalized = [...new Set((scopes?.length ? scopes : [LEAD_WRITE_SCOPE]).map((scope) => scope.trim()))];
  if (normalized.length === 0 || normalized.some((scope) => !API_KEY_SCOPE_PATTERN.test(scope))) {
    throw new Error("Invalid API key scopes");
  }
  return normalized;
}

export async function createApiKey(input: {
  companyId: string;
  leadSourceId: string;
  name: string;
  hmacRequired?: boolean;
  expiresAt?: Date;
  scopes?: string[];
}) {
  const material = createApiKeyMaterial();
  const scopes = normalizeScopes(input.scopes);
  const hmacRequired = input.hmacRequired ?? scopes.includes(LEAD_WRITE_SCOPE);
  const apiKey = await prisma.apiKey.create({
    data: {
      companyId: input.companyId,
      leadSourceId: input.leadSourceId,
      name: input.name,
      prefix: material.prefix,
      keyHash: material.keyHash,
      hmacRequired,
      hmacSecretEncrypted: hmacRequired ? encryptSecret(material.hmacSecret) : null,
      scopes,
      expiresAt: input.expiresAt,
    },
  });

  // Return only at creation time. Persisted storage contains a one-way key hash.
  return { apiKey, rawKey: material.rawKey, hmacSecret: hmacRequired ? material.hmacSecret : null };
}

function parseSignature(signature: string | null, timestampHeader: string | null) {
  if (!signature || !timestampHeader) return null;
  if (!/^\d{10,13}$/.test(timestampHeader) || !/^[a-f0-9]{64}$/i.test(signature)) return null;
  const timestamp = Number(timestampHeader.length === 10 ? `${timestampHeader}000` : timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > MAX_SIGNATURE_AGE_MS) return null;
  return { timestamp: timestampHeader, timestampMs: timestamp, signature: signature.toLowerCase() };
}

function parseIdempotencyKey(value: string | null) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || /[\r\n]/.test(normalized)) return null;
  return normalized;
}

export async function authenticateIngestRequest(headers: Headers, rawBody: string, requiredScope: string = LEAD_WRITE_SCOPE) {
  const rawKey = headers.get("x-api-key");
  if (!rawKey || rawKey.length > 256) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: sha256(rawKey) },
    include: {
      company: { select: { id: true, status: true } },
      leadSource: {
        select: {
          id: true,
          companyId: true,
          domain: true,
          status: true,
          allowedCategorySlugs: true,
          allowedServices: true,
        },
      },
    },
  });
  if (
    !apiKey ||
    apiKey.status !== ApiKeyStatus.ACTIVE ||
    (apiKey.expiresAt && apiKey.expiresAt <= new Date())
  ) {
    return null;
  }
  if (
    !apiKey.leadSourceId ||
    !apiKey.leadSource ||
    apiKey.company.status !== "ACTIVE" ||
    apiKey.leadSource.status !== "ACTIVE" ||
    apiKey.leadSource.companyId !== apiKey.companyId
  ) {
    return null;
  }

  const scopes = apiKey.scopes?.length ? apiKey.scopes : [LEAD_WRITE_SCOPE];
  if (!scopes.includes(requiredScope)) return null;

  let replay: IngestReplayClaim | undefined;

  // A leads:write key is an external production ingest credential. Requiring
  // HMAC here (rather than trusting a mutable per-key flag) makes old keys
  // fail closed after the signed-ingest rollout.
  if (scopes.includes(requiredScope)) {
    if (!apiKey.hmacSecretEncrypted) return null;
    const parsed = parseSignature(
      headers.get("x-linkconnect-signature"),
      headers.get("x-linkconnect-timestamp"),
    );
    if (!parsed) return null;

    const expected = createHmac("sha256", decryptSecret(apiKey.hmacSecretEncrypted))
      .update(`${parsed.timestamp}.${rawBody}`, "utf8")
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(parsed.signature, "hex");
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      return null;
    }
    replay = {
      replayKey: sha256(`hmac:${parsed.timestamp}:${parsed.signature}`),
      requestHash: sha256(rawBody),
      expiresAt: new Date(Date.now() + MAX_SIGNATURE_AGE_MS),
    };
  } else {
    const idempotencyKey = parseIdempotencyKey(headers.get("idempotency-key"));
    if (headers.has("idempotency-key") && !idempotencyKey) return null;
    if (idempotencyKey) {
      replay = {
        replayKey: sha256(`idempotency:${idempotencyKey}`),
        requestHash: sha256(rawBody),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
    }
  }

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  return replay ? { ...apiKey, replay } : apiKey;
}

export function redactApiKeyForAudit(apiKey: { id: string; prefix: string }) {
  return { id: apiKey.id, prefix: apiKey.prefix } satisfies Prisma.InputJsonObject;
}
