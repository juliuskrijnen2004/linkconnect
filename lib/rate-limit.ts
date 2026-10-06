import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

import { RateLimitError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

function clientAddress(request: Request) {
  return request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

// PostgreSQL performs this increment atomically. An in-memory map is ineffective
// when requests are handled by different serverless instances.
export async function enforceRateLimit(request: Request, bucket: string, limit: number, windowMs: number) {
  const now = Date.now();
  const resetAt = new Date(now + windowMs);
  const key = createHash("sha256").update(`${bucket}:${clientAddress(request)}`).digest("hex");
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>(Prisma.sql`
    INSERT INTO "RateLimitEntry" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitEntry"."resetAt" <= NOW() THEN 1 ELSE "RateLimitEntry"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitEntry"."resetAt" <= NOW() THEN ${resetAt} ELSE "RateLimitEntry"."resetAt" END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `);
  const entry = rows[0];
  if (!entry) throw new Error("Rate limit counter was not returned");
  if (entry.count > limit) {
    throw new RateLimitError(Math.max(1, Math.ceil((entry.resetAt.getTime() - now) / 1000)));
  }
}
