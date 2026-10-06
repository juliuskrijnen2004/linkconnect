import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const notificationEvents = {
  newLead: "Nieuwe lead",
  newCandidate: "Nieuwe kandidaat",
  newInvoice: "Nieuwe factuur",
  paymentSucceeded: "Betaling geslaagd",
  paymentFailed: "Betaling mislukt",
  disputeUpdated: "Update leadgeschil",
  accountUpdated: "Update accountstatus",
} as const;

export const COMPANY_EMAIL_OUTBOX_EVENT = "company.email";

export type CompanyEmailPayload = {
  eventType: string;
  subject: string;
  text: string;
};

export async function sendCompanyEmail(input: {
  companyId: string;
  eventType: string;
  subject: string;
  text: string;
  idempotencyKey?: string;
}) {
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: {
      email: true,
      notifications: { where: { eventType: input.eventType }, select: { email: true }, take: 1 },
    },
  });
  if (!company?.email) return { sent: false, reason: "no_recipient" as const };
  if (company.notifications[0]?.email === false) return { sent: false, reason: "disabled" as const };

  const { RESEND_API_KEY, EMAIL_FROM } = getServerEnv();
  if (!RESEND_API_KEY || !EMAIL_FROM) return { sent: false, reason: "not_configured" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
      ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [company.email], subject: input.subject, text: input.text }),
  });
  if (!response.ok) {
    console.error("Transactional email delivery failed", {
      companyId: input.companyId,
      eventType: input.eventType,
      status: response.status,
    });
    return { sent: false, reason: "provider_error" as const };
  }
  return { sent: true as const };
}
