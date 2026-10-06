import { Role } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { resolveDispute } from "@/lib/disputes";
import { errorResponse } from "@/lib/http";
const schema=z.object({decision:z.enum(["APPROVE_CREDIT","REJECT"]),resolution:z.string().min(3).max(2000)});
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{assertSameOrigin(request);const session=await requireRole(Role.ADMIN);const{id}=await params;const input=schema.parse(await request.json());return Response.json({dispute:await resolveDispute({disputeId:z.string().uuid().parse(id),actorUserId:session.userId,...input})})}catch(error){return errorResponse(error)}}
