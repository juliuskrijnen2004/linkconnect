import { requireSession } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    return Response.json({ session: await requireSession() });
  } catch (error) {
    return errorResponse(error);
  }
}
