import { AllocationStatus, AuditActorType, InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/http";
import { COMPANY_EMAIL_OUTBOX_EVENT, notificationEvents } from "@/lib/notifications";
import { enqueueOutboxEvent } from "@/lib/outbox";

export async function createInvoiceDraft(input: {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  actorUserId?: string;
}) {
  if (input.periodStart >= input.periodEnd) {
    throw new BadRequestError("Invoice period end must be after period start");
  }
  return prisma.$transaction(async (tx) => {
    // Serializes draft generation for a company; invoice lines cannot be claimed by two workers.
    await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${input.companyId}::uuid FOR UPDATE`;
    const existing = await tx.invoice.findUnique({
      where: {
        companyId_periodStart_periodEnd: {
          companyId: input.companyId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
      },
      include: { lines: true },
    });
    if (existing) return existing;
    const allocations = await tx.allocation.findMany({
      where: {
        companyId: input.companyId,
        status: AllocationStatus.ACCEPTED,
        acceptedAt: { gte: input.periodStart, lt: input.periodEnd },
        invoiceLine: null,
      },
      orderBy: { acceptedAt: "asc" },
    });
    const opportunityAllocations = await tx.opportunityAllocation.findMany({
      where: { companyId: input.companyId, status: AllocationStatus.ACCEPTED, acceptedAt: { gte: input.periodStart, lt: input.periodEnd }, invoiceLine: null },
      include: { opportunity: { select: { type: true } } }, orderBy: { acceptedAt: "asc" },
    });
    if (allocations.length + opportunityAllocations.length === 0) throw new ConflictError("No uninvoiced accepted allocations for this period");

    const currency = allocations[0]?.currency ?? opportunityAllocations[0].currency;
    if (allocations.some((allocation) => allocation.currency !== currency) || opportunityAllocations.some((allocation) => allocation.currency !== currency)) {
      throw new ConflictError("An invoice may contain only one currency");
    }
    const subtotalCents = allocations.reduce((total, allocation) => total + allocation.priceCents, 0) + opportunityAllocations.reduce((total, allocation) => total + allocation.priceCents, 0);
    const invoice = await tx.invoice.create({
      data: {
        companyId: input.companyId,
        currency,
        subtotalCents,
        totalCents: subtotalCents,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        lines: {
          create: [...allocations.map((allocation) => ({
            allocationId: allocation.id,
            description: `Lead allocation ${allocation.id}`,
            unitCents: allocation.priceCents,
            totalCents: allocation.priceCents,
          })), ...opportunityAllocations.map((allocation) => ({
            opportunityAllocationId: allocation.id,
            description: `${allocation.opportunity.type === "CANDIDATE" ? "Candidate" : "Opportunity"} allocation ${allocation.id}`,
            unitCents: allocation.priceCents,
            totalCents: allocation.priceCents,
          }))],
        },
      },
      include: { lines: true },
    });
    await tx.allocation.updateMany({
      where: { id: { in: allocations.map((allocation) => allocation.id) } },
      data: { status: AllocationStatus.INVOICED },
    });
    await tx.opportunityAllocation.updateMany({ where: { id: { in: opportunityAllocations.map((allocation) => allocation.id) } }, data: { status: AllocationStatus.INVOICED } });
    await tx.auditLog.create({
      data: {
        companyId: input.companyId,
        actorType: input.actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
        actorUserId: input.actorUserId,
        action: "invoice.drafted",
        entityType: "Invoice",
        entityId: invoice.id,
        invoiceId: invoice.id,
        metadata: { allocationCount: allocations.length + opportunityAllocations.length, salesLeadCount: allocations.length, candidateCount: opportunityAllocations.length, subtotalCents, currency },
      },
    });
    return invoice;
  });
}

// Stripe owns mandates and bank-account details. We send only invoice amounts and its customer ID.
export async function publishInvoiceToStripe(invoiceId: string, actorUserId?: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true, lines: true },
  });
  if (!invoice) throw new NotFoundError("Invoice not found");
  if (invoice.status !== InvoiceStatus.DRAFT) throw new ConflictError("Only draft invoices can be sent to Stripe");
  if (!invoice.company.stripeCustomerId) throw new ConflictError("Company has no Stripe customer");

  const stripe = getStripe();
  let stripeInvoiceId = invoice.stripeInvoiceId;
  if (!stripeInvoiceId) {
    const stripeInvoice = await stripe.invoices.create({
      customer: invoice.company.stripeCustomerId,
      collection_method: "charge_automatically",
      auto_advance: false,
      payment_settings: { payment_method_types: ["sepa_debit"] },
      metadata: { linkconnectInvoiceId: invoice.id },
    }, { idempotencyKey: `linkconnect-invoice-${invoice.id}` });
    if (!stripeInvoice.id) throw new Error("Stripe did not return an invoice ID");
    stripeInvoiceId = stripeInvoice.id;
    await prisma.invoice.update({ where: { id: invoice.id }, data: { stripeInvoiceId } });
  }
  await Promise.all(
    invoice.lines.map((line) =>
      stripe.invoiceItems.create({
        customer: invoice.company.stripeCustomerId!,
        invoice: stripeInvoiceId,
        currency: invoice.currency.toLowerCase(),
        amount: line.totalCents,
        description: line.description,
        metadata: { linkconnectInvoiceLineId: line.id },
      }, { idempotencyKey: `linkconnect-invoice-line-${line.id}` }),
    ),
  );
  const finalized = await stripe.invoices.finalizeInvoice(stripeInvoiceId, {}, { idempotencyKey: `linkconnect-finalize-${invoice.id}` });
  if (!finalized.id) throw new Error("Stripe did not return a finalized invoice ID");
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      stripeInvoiceId: finalized.id,
      status: finalized.status === "paid" ? InvoiceStatus.PAID : InvoiceStatus.OPEN,
      dueAt: finalized.due_date ? new Date(finalized.due_date * 1000) : null,
      paidAt: finalized.status_transitions.paid_at
        ? new Date(finalized.status_transitions.paid_at * 1000)
        : null,
    },
  });
  await prisma.auditLog.create({
    data: {
      companyId: invoice.companyId,
      actorType: actorUserId ? AuditActorType.USER : AuditActorType.SYSTEM,
      actorUserId,
      action: "invoice.published",
      entityType: "Invoice",
      entityId: invoice.id,
      invoiceId: invoice.id,
      metadata: { stripeInvoiceId: finalized.id, status: updated.status },
    },
  });
  await enqueueOutboxEvent(prisma, {
    dedupeKey: `notification:new-invoice:${invoice.id}`,
    eventType: COMPANY_EMAIL_OUTBOX_EVENT,
    aggregateType: "Invoice",
    aggregateId: invoice.id,
    companyId: invoice.companyId,
    payload: {
      eventType: notificationEvents.newInvoice,
      subject: "Nieuwe factuur in LinkConnect",
      text: "Er staat een nieuwe factuur voor je klaar in het beveiligde LinkConnect-dashboard.",
    },
  });
  return updated;
}

export async function recordStripeInvoiceEvent(input: {
  eventId: string;
  eventType: string;
  stripeInvoiceId: string;
  providerPaymentId: string;
  stripeCustomerId: string | null;
  status: string | null;
  paidAt: number | null;
  amountCents: number;
  currency: string;
  failureCode?: string | null;
}) {
  const company = input.stripeCustomerId
    ? await prisma.company.findUnique({
        where: { stripeCustomerId: input.stripeCustomerId },
        select: { id: true },
      })
    : null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.stripeWebhookEvent.create({
        data: { eventId: input.eventId, eventType: input.eventType, companyId: company?.id },
      });
      const localInvoice = await tx.invoice.findUnique({
        where: { stripeInvoiceId: input.stripeInvoiceId },
        select: { id: true, companyId: true, status: true },
      });
      if (localInvoice) {
        const paidAt = input.paidAt ? new Date(input.paidAt * 1000) : null;
        const reportedStatus = input.status === "paid"
          ? InvoiceStatus.PAID
          : input.status === "void"
            ? InvoiceStatus.VOID
            : input.status === "uncollectible"
              ? InvoiceStatus.UNCOLLECTIBLE
              : InvoiceStatus.OPEN;
        const terminal = [InvoiceStatus.PAID, InvoiceStatus.VOID] as InvoiceStatus[];
        const nextStatus = terminal.includes(localInvoice.status) ? localInvoice.status : reportedStatus;
        await tx.invoice.update({
          where: { id: localInvoice.id },
          data: { status: nextStatus, paidAt: nextStatus === InvoiceStatus.PAID ? paidAt : undefined },
        });
        const paymentStatus = nextStatus === InvoiceStatus.PAID
          ? PaymentStatus.SUCCEEDED
          : input.eventType === "invoice.payment_failed"
            ? PaymentStatus.FAILED
            : PaymentStatus.PENDING;
        await tx.payment.upsert({
          where: { providerPaymentId: input.providerPaymentId },
          create: {
            companyId: localInvoice.companyId,
            invoiceId: localInvoice.id,
            providerPaymentId: input.providerPaymentId,
            status: paymentStatus,
            amountCents: input.amountCents,
            currency: input.currency.toUpperCase(),
            failureCode: input.failureCode ?? null,
            paidAt,
          },
          update: {
            status: paymentStatus === PaymentStatus.SUCCEEDED ? paymentStatus : undefined,
            amountCents: input.amountCents,
            failureCode: input.failureCode ?? null,
            paidAt,
          },
        });
        await tx.sepaMandate.updateMany({
          where: { companyId: localInvoice.companyId, status: "ACTIVE" },
          data: input.status === "paid"
            ? { lastSuccessfulPaymentAt: paidAt, failedPaymentCount: 0 }
            : input.eventType === "invoice.payment_failed"
              ? { failedPaymentCount: { increment: 1 } }
              : {},
        });
      }
      await tx.auditLog.create({
        data: {
          companyId: company?.id,
          actorType: AuditActorType.STRIPE,
          action: "stripe.invoice_event",
          entityType: "StripeInvoice",
          entityId: input.stripeInvoiceId,
          metadata: { eventType: input.eventType, invoiceMatched: Boolean(localInvoice), status: input.status },
        },
      });
      await tx.stripeWebhookEvent.update({
        where: { eventId: input.eventId },
        data: { processedAt: new Date() },
      });
    });
    return { duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { duplicate: true };
    }
    throw error;
  }
}

// Stripe credit notes/refunds can be issued by the finance system. We ingest the
// signed event so payment state and audit history do not diverge from Stripe.
export async function recordStripeCreditNoteEvent(input: {
  eventId: string;
  eventType: string;
  stripeCreditNoteId: string;
  stripeInvoiceId: string | null;
  amountCents: number;
  currency: string;
}) {
  try {
    await prisma.$transaction(async (tx) => {
      const invoice = input.stripeInvoiceId
        ? await tx.invoice.findUnique({ where: { stripeInvoiceId: input.stripeInvoiceId }, select: { id: true, companyId: true, totalCents: true, creditedCents: true } })
        : null;
      await tx.stripeWebhookEvent.create({
        data: { eventId: input.eventId, eventType: input.eventType, companyId: invoice?.companyId },
      });
      if (invoice) {
        const creditedCents = Math.min(invoice.totalCents, invoice.creditedCents + input.amountCents);
        await tx.invoice.update({ where: { id: invoice.id }, data: { creditedCents } });
        const paymentStatus = creditedCents >= invoice.totalCents ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
        await tx.payment.updateMany({
          where: { invoiceId: invoice.id, status: PaymentStatus.SUCCEEDED },
          data: { status: paymentStatus },
        });
        await tx.auditLog.create({
          data: {
            companyId: invoice.companyId,
            actorType: AuditActorType.STRIPE,
            action: "stripe.credit_note_recorded",
            entityType: "StripeCreditNote",
            entityId: input.stripeCreditNoteId,
            invoiceId: invoice.id,
            metadata: { eventType: input.eventType, amountCents: input.amountCents, creditedCents, currency: input.currency.toUpperCase() },
          },
        });
      }
      await tx.stripeWebhookEvent.update({ where: { eventId: input.eventId }, data: { processedAt: new Date() } });
    });
    return { duplicate: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { duplicate: true };
    throw error;
  }
}
