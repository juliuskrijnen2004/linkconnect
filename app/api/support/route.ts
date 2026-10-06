import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ subject: z.string().min(2).max(120), message: z.string().min(10).max(5000), leadId: z.string().optional() });
export async function POST(request: Request) { try { assertSameOrigin(request); const session = await requireCompanySession(); if (!session.companyId) return Response.json({ error: "Company required" }, { status: 403 }); const input = schema.parse(Object.fromEntries(await request.formData())); await prisma.auditLog.create({ data: { companyId: session.companyId, actorUserId: session.userId, actorType: "USER", action: "support.requested", entityType: "SupportRequest", entityId: crypto.randomUUID(), metadata: { subject: input.subject, leadId: input.leadId ?? null, messageLength: input.message.length } } }); return NextResponse.redirect(new URL("/dashboard/support?sent=1", request.url), 303); } catch (error) { return errorResponse(error); } }
