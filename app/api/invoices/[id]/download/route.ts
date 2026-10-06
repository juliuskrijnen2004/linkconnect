import { requireCompanySession } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCompanySession();
    const { id } = await context.params;
    const invoice = await prisma.invoice.findFirst({
      where: { id, companyId: session.companyId ?? undefined },
      select: { stripeInvoiceId: true },
    });
    if (!invoice?.stripeInvoiceId) {
      return Response.json({ error: "Factuur is niet beschikbaar" }, { status: 404 });
    }
    const stripeInvoice = await getStripe().invoices.retrieve(invoice.stripeInvoiceId);
    if (!stripeInvoice.invoice_pdf) {
      return Response.json({ error: "PDF is nog niet beschikbaar" }, { status: 409 });
    }
    return Response.redirect(stripeInvoice.invoice_pdf, 303);
  } catch (error) {
    return errorResponse(error);
  }
}
