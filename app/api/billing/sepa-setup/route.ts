import { NextResponse } from "next/server";
import { requireCompanySession } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/http";
import { assertSameOrigin } from "@/lib/csrf";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireCompanySession();
    if (!session.companyId) return Response.json({ error: "Company account required" }, { status: 403 });
    const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });
    const stripe = getStripe();
    const customerId = company.stripeCustomerId ?? (await stripe.customers.create(
      { name: company.name, email: company.email ?? undefined, metadata: { companyId: company.id } },
      { idempotencyKey: `linkconnect-company-${company.id}` },
    )).id;
    if (!company.stripeCustomerId) await prisma.company.update({ where: { id: company.id }, data: { stripeCustomerId: customerId } });
    const origin = new URL(request.url).origin;
    const setup = await stripe.checkout.sessions.create(
      { mode: "setup", customer: customerId, payment_method_types: ["sepa_debit"], success_url: `${origin}/dashboard?sepa=success`, cancel_url: `${origin}/onboarding?sepa=cancelled`, metadata: { companyId: company.id } },
      { idempotencyKey: `linkconnect-sepa-setup-${company.id}-${Math.floor(Date.now() / 60_000)}` },
    );
    if (!setup.url) throw new Error("Stripe did not return a setup URL");
    return NextResponse.redirect(setup.url, 303);
  } catch (error) { return errorResponse(error); }
}
