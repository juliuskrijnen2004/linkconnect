import { CandidateStatus } from "@prisma/client";
import { z } from "zod";
import { requireCompanySession } from "@/lib/auth";
import { updateCandidateStatus } from "@/lib/candidate-allocations";
import { errorResponse } from "@/lib/http";
const schema = z.object({ status: z.nativeEnum(CandidateStatus) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireCompanySession(); if (!session.companyId) return Response.json({ error: "Forbidden" }, { status: 403 }); const { id } = await params; await updateCandidateStatus(session.companyId, id, schema.parse(await request.json()).status); return Response.json({ ok: true }); } catch (error) { return errorResponse(error); } }
