import { CandidateStatus } from "@prisma/client";
import { z } from "zod";
import { requireCompanySession } from "@/lib/auth";
import { updateCandidateStatus } from "@/lib/candidate-allocations";
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse } from "@/lib/http";
const schema = z.object({ status: z.nativeEnum(CandidateStatus) });
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { assertSameOrigin(request); const session = await requireCompanySession(); if (!session.companyId) return Response.json({ error: "Forbidden" }, { status: 403 }); const { id } = await params; await updateCandidateStatus({ companyId: session.companyId, opportunityId: z.string().uuid().parse(id), status: schema.parse(await request.json()).status, actorUserId: session.userId }); return Response.json({ ok: true }); } catch (error) { return errorResponse(error); } }
