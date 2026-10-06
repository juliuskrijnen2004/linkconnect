import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

import { getServerEnv } from "@/lib/env";

export type SessionRole = "COMPANY" | "ADMIN";
export type SessionClaims = {
  userId: string;
  companyId: string | null;
  role: SessionRole;
  sessionVersion: number;
};

export const SESSION_COOKIE = "lc_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function jwtSecret() {
  return new TextEncoder().encode(getServerEnv().AUTH_JWT_SECRET);
}

export async function createSessionToken(claims: SessionClaims) {
  return new SignJWT({
    companyId: claims.companyId,
    role: claims.role,
    sessionVersion: claims.sessionVersion,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(jwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "COMPANY") ||
      typeof payload.sessionVersion !== "number" ||
      (payload.companyId !== null && typeof payload.companyId !== "string")
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      companyId: (payload.companyId as string | null | undefined) ?? null,
      role: payload.role,
      sessionVersion: payload.sessionVersion,
    };
  } catch {
    return null;
  }
}

export { SESSION_TTL_SECONDS };
