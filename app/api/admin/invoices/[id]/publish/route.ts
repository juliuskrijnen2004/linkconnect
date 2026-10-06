import { Role } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { assertSameOrigin } from "@/lib/csrf";
import { publishInvoiceToStripe } from "@/lib/billing";
import { errorResponse } from "@/lib/http";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{assertSameOrigin(request);const session=await requireRole(Role.ADMIN);const{id}=await params;return Response.json({invoice:await publishInvoiceToStripe(z.string().uuid().parse(id),session.userId)})}catch(error){return errorResponse(error)}}
