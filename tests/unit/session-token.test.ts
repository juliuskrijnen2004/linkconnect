import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "@/lib/session-token";

const claims = {
  userId: "user-1",
  companyId: "company-1",
  role: "COMPANY" as const,
  sessionVersion: 3,
};

describe("session tokens", () => {
  it("round-trips the supported claims and exposes the expected cookie contract", async () => {
    const token = await createSessionToken(claims);

    await expect(verifySessionToken(token)).resolves.toEqual(claims);
    expect(SESSION_COOKIE).toBe("lc_session");
    expect(SESSION_TTL_SECONDS).toBe(8 * 60 * 60);
  });

  it("rejects a token with a modified signature", async () => {
    const token = await createSessionToken(claims);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    await expect(verifySessionToken(tampered)).resolves.toBeNull();
  });

  it("rejects structurally invalid claims even when the signature is valid", async () => {
    const token = await new SignJWT({
      companyId: "company-1",
      role: "UNKNOWN",
      sessionVersion: 3,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));

    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it("returns null for malformed input", async () => {
    await expect(verifySessionToken("not-a-jwt")).resolves.toBeNull();
  });
});
