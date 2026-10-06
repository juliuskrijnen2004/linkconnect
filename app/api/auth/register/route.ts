import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, sessionCookie } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "register", 5, 60 * 60_000);
    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
    const input = schema.parse(payload);
    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) return Response.json({ error: "E-mailadres is al in gebruik" }, { status: 409 });
    const passwordHash = await hash(input.password, 12);
    const slugBase = input.companyName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "bedrijf";
    const user = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { name: input.companyName, slug: `${slugBase}-${randomUUID().slice(0, 8)}`, contactName: input.contactName, email: input.email, phone: input.phone } });
      return tx.user.create({ data: { companyId: company.id, email: input.email, name: input.contactName, passwordHash, role: "COMPANY" } });
    });
    const token = await createSessionToken({ userId: user.id, companyId: user.companyId, role: user.role, sessionVersion: user.sessionVer });
    const response = contentType.includes("application/json") ? NextResponse.json({ userId: user.id }, { status: 201 }) : NextResponse.redirect(new URL("/onboarding", request.url), 303);
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) { return errorResponse(error); }
}
