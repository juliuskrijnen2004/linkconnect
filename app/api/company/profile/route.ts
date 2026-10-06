import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanySession } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({ companyName: z.string().trim().min(2).max(160), contactName: z.string().trim().min(2).max(160), kvk: z.string().trim().min(6).max(20), vat: z.string().trim().min(6).max(32), email: z.string().email(), phone: z.string().min(6).max(40), website: z.string().url().optional().or(z.literal("")) });

export async function POST(request: Request) { try { assertSameOrigin(request); const session = await requireCompanySession(); if (!session.companyId) return Response.json({ error: "Company required" }, { status: 403 }); const input = schema.parse(Object.fromEntries(await request.formData())); await prisma.company.update({ where: { id: session.companyId }, data: { name: input.companyName, contactName: input.contactName, kvkNumber: input.kvk, vatNumber: input.vat, email: input.email, phone: input.phone, website: input.website || null } }); return NextResponse.redirect(new URL("/dashboard/bedrijf?saved=1", request.url), 303); } catch (error) { return errorResponse(error); } }
