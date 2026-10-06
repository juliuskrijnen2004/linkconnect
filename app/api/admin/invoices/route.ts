import { Role } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { createInvoiceDraft } from "@/lib/billing";
import { errorResponse } from "@/lib/http";
const schema=z.object({companyId:z.string().uuid(),periodStart:z.coerce.date(),periodEnd:z.coerce.date()});
export async function POST(request:Request){try{assertSameOrigin(request);const session=await requireRole(Role.ADMIN);const input=schema.parse(await request.json());return Response.json({invoice:await createInvoiceDraft({...input,actorUserId:session.userId})},{status:201})}catch(error){return errorResponse(error)}}
