import Stripe from "stripe";

import { errorResponse } from "@/lib/http";
import { recordStripeCreditNoteEvent, recordStripeInvoiceEvent } from "@/lib/billing";
import { getServerEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { STRIPE_WEBHOOK_SECRET } = getServerEnv();
    if (!STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Stripe webhook is unavailable" }, { status: 503 });
    const signature = request.headers.get("stripe-signature");
    if (!signature) return Response.json({ error: "Missing Stripe signature" }, { status: 400 });
    const event = getStripe().webhooks.constructEvent(await request.text(), signature, STRIPE_WEBHOOK_SECRET);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;
      const setupIntentId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent?.id;
      if (!companyId || !setupIntentId) return Response.json({ error: "Missing setup metadata" }, { status: 400 });
      const sessionCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { stripeCustomerId: true },
      });
      if (!company?.stripeCustomerId || company.stripeCustomerId !== sessionCustomerId) {
        return Response.json({ error: "Stripe customer does not match company" }, { status: 400 });
      }
      const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId, { expand: ["latest_attempt"] });
      const setupCustomerId = typeof setupIntent.customer === "string" ? setupIntent.customer : setupIntent.customer?.id;
      if (setupCustomerId !== company.stripeCustomerId) {
        return Response.json({ error: "Setup intent does not match company" }, { status: 400 });
      }
      const mandateId = typeof setupIntent.mandate === "string" ? setupIntent.mandate : setupIntent.mandate?.id ?? null;
      await prisma.$transaction(async tx => {
        const seen = await tx.stripeWebhookEvent.findUnique({ where: { eventId: event.id } });
        if (seen) return;
        await tx.stripeWebhookEvent.create({ data: { eventId: event.id, eventType: event.type, companyId, processedAt: new Date() } });
        await tx.sepaMandate.updateMany({ where: { companyId, status: "PENDING" }, data: { status: setupIntent.status === "succeeded" ? "ACTIVE" : "PENDING", providerMandateId: mandateId } });
        await tx.auditLog.create({ data: { companyId, actorType: "STRIPE", action: "sepa.mandate_updated", entityType: "SepaMandate", entityId: mandateId ?? setupIntentId, metadata: { setupStatus: setupIntent.status } } });
      });
      return Response.json({ received: true });
    }

    if (event.type.startsWith("invoice.")) {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.id) return Response.json({ error: "Stripe event has no invoice ID" }, { status: 400 });
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
      const invoicePayment = invoice.payments?.data.find((payment) => payment.is_default) ?? invoice.payments?.data[0];
      const paymentIntent = invoicePayment?.payment.payment_intent;
      const charge = invoicePayment?.payment.charge;
      const providerPaymentId = typeof paymentIntent === "string"
        ? paymentIntent
        : paymentIntent?.id ?? (typeof charge === "string" ? charge : charge?.id) ?? `invoice:${invoice.id}`;
      const result = await recordStripeInvoiceEvent({
        eventId: event.id,
        eventType: event.type,
        stripeInvoiceId: invoice.id,
        providerPaymentId,
        stripeCustomerId: customerId,
        status: invoice.status,
        paidAt: invoice.status_transitions.paid_at,
        amountCents: invoice.amount_paid || invoice.total,
        currency: invoice.currency,
        failureCode: invoice.last_finalization_error?.code ?? null,
      });
      return Response.json({ received: true, duplicate: result.duplicate });
    }
    if (event.type === "credit_note.created") {
      const creditNote = event.data.object as Stripe.CreditNote;
      const invoiceId = typeof creditNote.invoice === "string" ? creditNote.invoice : creditNote.invoice?.id ?? null;
      const result = await recordStripeCreditNoteEvent({ eventId: event.id, eventType: event.type, stripeCreditNoteId: creditNote.id, stripeInvoiceId: invoiceId, amountCents: creditNote.total, currency: creditNote.currency });
      return Response.json({ received: true, duplicate: result.duplicate });
    }
    return Response.json({ received: true, ignored: true });
  } catch (error) {
    return errorResponse(error);
  }
}
