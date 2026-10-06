import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { assertSameOrigin } from "@/lib/csrf";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth";
import { requireTenantCompanyId, tenantScope } from "@/lib/tenant";

describe("server security helpers", () => {
  beforeEach(() => {
    let count = 0;
    prismaMock.$queryRaw.mockImplementation(async () => [{
      count: ++count,
      resetAt: new Date(Date.now() + 60_000),
    }]);
  });

  it("encrypts and decrypts a secret without storing it in plaintext", () => {
    const encrypted = encryptSecret("hmac-secret");

    expect(encrypted).not.toContain("hmac-secret");
    expect(decryptSecret(encrypted)).toBe("hmac-secret");
  });

  it("rejects tampered and malformed encrypted values", () => {
    const encrypted = encryptSecret("hmac-secret");
    const [iv, tag, ciphertext] = encrypted.split(".");

    const alteredTag = Buffer.from(tag, "base64url");
    alteredTag[0] ^= 1;

    expect(() => decryptSecret(`${iv}.${alteredTag.toString("base64url")}.${ciphertext}`)).toThrow();
    expect(() => decryptSecret("not-a-secret")).toThrow("Malformed encrypted secret");
  });

  it("requires a same-origin header for cookie-authenticated browser requests", () => {
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/me"))).toThrow(ForbiddenError);
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/me", {
      headers: { origin: "http://localhost:3000" },
    }))).not.toThrow();
    expect(() => assertSameOrigin(new Request("http://localhost:3000/api/me", {
      headers: { origin: "https://attacker.example" },
    }))).toThrow(ForbiddenError);
  });

  it("keeps company sessions inside their tenant and lets admins scope explicitly", () => {
    const companySession = { userId: "u1", companyId: "company-1", role: "COMPANY" as const, sessionVersion: 1 };
    const adminSession = { userId: "u2", companyId: null, role: "ADMIN" as const, sessionVersion: 1 };

    expect(tenantScope(companySession)).toEqual({ companyId: "company-1" });
    expect(requireTenantCompanyId(companySession, "company-1")).toBe("company-1");
    expect(tenantScope(adminSession, "company-2")).toEqual({ companyId: "company-2" });
    expect(tenantScope(adminSession)).toEqual({});
    expect(() => tenantScope(companySession, "company-2")).toThrow(ForbiddenError);
    expect(() => requireTenantCompanyId(adminSession)).toThrow(ForbiddenError);
  });

  it("maps known errors to stable HTTP responses", async () => {
    const invalid = errorResponse(z.object({ required: z.string() }).safeParse({}).error);
    const unauthorized = errorResponse(new UnauthorizedError());
    const forbidden = errorResponse(new ForbiddenError());

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: "Invalid request" });
    expect(unauthorized.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it("limits repeated requests per forwarded client address", async () => {
    const request = () => new Request("http://localhost:3000/api/login", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const bucket = `security-test-${Date.now()}-${Math.random()}`;

    await enforceRateLimit(request(), bucket, 2, 60_000);
    await enforceRateLimit(request(), bucket, 2, 60_000);
    await expect(enforceRateLimit(request(), bucket, 2, 60_000)).rejects.toMatchObject({
      status: 429,
    });
  });
});
