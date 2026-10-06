import { NextResponse } from "next/server";
import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) { try { assertSameOrigin(request); const session = await requireCompanySession(); if (!session.companyId) return Response.json({ error: "Company required" }, { status: 403 }); const data = await request.formData(); const enabled = new Set(data.getAll("notifications").map(String)); const events = ["Nieuwe lead", "Nieuwe kandidaat", "Nieuwe factuur", "Betaling geslaagd", "Betaling mislukt", "Update leadgeschil", "Update accountstatus"]; await prisma.$transaction(events.map(eventType => prisma.notificationPreference.upsert({ where: { companyId_eventType: { companyId: session.companyId!, eventType } }, update: { email: enabled.has(eventType) }, create: { companyId: session.companyId!, eventType, email: enabled.has(eventType) } }))); return NextResponse.redirect(new URL("/dashboard/instellingen?saved=1", request.url), 303); } catch (error) { return errorResponse(error); } }
