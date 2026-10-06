import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticatePassword, createSessionToken, sessionCookie } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(1024),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "login", 10, 60_000);
    const contentType = request.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
    const input = loginSchema.parse(payload);
    const user = await authenticatePassword(input.email, input.password);
    if (!user) return Response.json({ error: "Invalid email or password" }, { status: 401 });

    const token = await createSessionToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      sessionVersion: user.sessionVer,
    });
    const response = contentType.includes("application/json")
      ? NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, companyId: user.companyId } })
      : NextResponse.redirect(new URL(user.role === "ADMIN" ? "/admin" : "/dashboard", request.url), 303);
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
