import { Role } from "@prisma/client";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import {
  SessionClaims,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  verifySessionToken,
} from "@/lib/session-token";

export type { SessionClaims } from "@/lib/session-token";
export { createSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/session-token";

export async function authenticatePassword(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await compare(password, user.passwordHash))) {
    return null;
  }
  return user;
}

export async function getCurrentSession(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: { companyId: true, role: true, sessionVer: true },
  });
  if (
    !user ||
    user.sessionVer !== claims.sessionVersion ||
    user.companyId !== claims.companyId ||
    user.role !== claims.role
  ) {
    return null;
  }
  return claims;
}

export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export async function requireCompanySession() {
  const session = await requireSession();
  if (session.role !== Role.ADMIN && !session.companyId) throw new ForbiddenError();
  return session;
}

export async function requireRole(...roles: Role[]) {
  const session = await requireSession();
  if (!roles.includes(session.role as Role)) throw new ForbiddenError();
  return session;
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}
