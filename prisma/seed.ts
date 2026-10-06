import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { createApiKey } from "../lib/api-keys";
import { prisma } from "../lib/prisma";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Development seed is disabled in production");
  const password = process.env.SEED_ADMIN_PASSWORD ?? "LinkConnect-demo-2026!";
  const passwordHash = await hash(password, 12);

  const publisher = await prisma.company.upsert({ where: { slug: "linkconnect-source-network" }, update: { name: "LinkConnect Leadnetwerk" }, create: { name: "LinkConnect Leadnetwerk", slug: "linkconnect-source-network", status: "ACTIVE" } });
  const source = await prisma.leadSource.upsert({
    where: { companyId_slug: { companyId: publisher.id, slug: "linkconnect-demo" } },
    update: { name: "LinkConnect demo source", domain: "source.example", status: "ACTIVE", allowedCategorySlugs: [], allowedServices: [], maxRecipientsPerLead: 1 },
    create: { companyId: publisher.id, name: "LinkConnect demo source", slug: "linkconnect-demo", domain: "source.example", status: "ACTIVE", allowedCategorySlugs: [], allowedServices: [], maxRecipientsPerLead: 1 },
  });
  const buyer = await prisma.company.upsert({
    where: { slug: "van-dijk-installatietechniek" },
    update: { status: "ACTIVE", leadDeliveryActive: true },
    create: { name: "Van Dijk Installatietechniek", slug: "van-dijk-installatietechniek", contactName: "Mark van Dijk", email: "mark@vandijk-installatie.test", phone: "040 123 45 67", website: "https://vandijk-installatie.test", kvkNumber: "12345678", vatNumber: "NL001234567B01", status: "ACTIVE", leadDeliveryActive: true, minimumWeeklyLeads: 2, approvedAt: new Date() },
  });

  await Promise.all([
    prisma.user.upsert({ where: { email: "admin@linkconnect.test" }, update: { passwordHash, role: "ADMIN", companyId: null }, create: { email: "admin@linkconnect.test", name: "LinkConnect Admin", passwordHash, role: "ADMIN" } }),
    prisma.user.upsert({ where: { email: "mark@vandijk-installatie.test" }, update: { passwordHash, role: "COMPANY", companyId: buyer.id }, create: { email: "mark@vandijk-installatie.test", name: "Mark van Dijk", passwordHash, role: "COMPANY", companyId: buyer.id } }),
    prisma.sepaMandate.create({ data: { companyId: buyer.id, provider: "stripe", status: "ACTIVE", providerMandateId: `demo_mandate_${buyer.id}` } }).catch(() => null),
    prisma.companyAgreement.upsert({ where: { companyId_type_version: { companyId: buyer.id, type: "LEAD_TERMS", version: "2026-10-01" } }, update: {}, create: { companyId: buyer.id, type: "LEAD_TERMS", version: "2026-10-01", acceptedAt: new Date() } }),
  ]);

  const categories = [
    { slug: "dakwerk", name: "Dakwerk", priceCents: 3900, services: ["Dakreparatie", "Dakrenovatie", "Dakinspectie"] },
    { slug: "zonnepanelen", name: "Zonnepanelen", priceCents: 3250, services: ["Zonnepanelen plaatsen", "Zonnepanelen onderhoud", "Zonnepanelen advies"] },
    { slug: "loodgieter", name: "Loodgieter", priceCents: 2750, services: ["Lekkage verhelpen", "Badkamerinstallatie", "CV-onderhoud"] },
    { slug: "tiny-houses", name: "Tiny Houses", priceCents: 4950, services: ["Tiny house kopen", "Prefab tiny house", "Tiny house op maat", "Tiny house financiering"] },
  ];
  for (const categoryDefinition of categories) {
    const { slug, name, priceCents, services } = categoryDefinition;
    const category = await prisma.leadCategory.upsert({ where: { slug }, update: { active: true, name, defaultPriceCents: priceCents }, create: { slug, name, active: true, defaultPriceCents: priceCents } });
    for (const serviceName of services) {
      const serviceSlug = serviceName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "");
      await prisma.service.upsert({ where: { categoryId_slug: { categoryId: category.id, slug: serviceSlug } }, update: { name: serviceName, active: true }, create: { categoryId: category.id, slug: serviceSlug, name: serviceName, active: true } });
    }
    await prisma.companyLeadPreference.upsert({ where: { companyId_preferenceKey: { companyId: buyer.id, preferenceKey: `category:${slug}` } }, update: { active: true, categoryId: category.id }, create: { companyId: buyer.id, categoryId: category.id, preferenceKey: `category:${slug}` } });
    const ruleName = `${name} standaard`;
    const rule = await prisma.pricingRule.findFirst({ where: { companyId: buyer.id, name: ruleName } });
    if (!rule) await prisma.pricingRule.create({ data: { companyId: buyer.id, name: ruleName, category: name, postalPrefixes: [], priceCents, priority: 10 } });
  }
  for (const region of ["Noord-Brabant", "Gelderland"]) await prisma.companyRegion.upsert({ where: { companyId_region: { companyId: buyer.id, region } }, update: { active: true }, create: { companyId: buyer.id, region, radiusKm: 50 } });

  const demoLeads = [
    { externalId: "demo-1001", category: "Zonnepanelen", name: "Thomas de Vries", city: "Eindhoven", postcode: "5611", price: 3250 },
    { externalId: "demo-1002", category: "Dakwerk", name: "Sophie Jansen", city: "Tilburg", postcode: "5038", price: 3900 },
    { externalId: "demo-1003", category: "Loodgieter", name: "M. van den Berg", city: "Nijmegen", postcode: "6511", price: 2750 },
    { externalId: "demo-1004", category: "Tiny Houses", name: "Noor de Boer", city: "Eindhoven", postcode: "5611", price: 4950 },
  ];
  for (const item of demoLeads) {
    const fingerprint = createHash("sha256").update(`${source.id}:${item.externalId}`).digest("hex");
    const existingLead = await prisma.lead.findFirst({ where: { leadSourceId: source.id, externalId: item.externalId } });
    const lead = existingLead
      ? await prisma.lead.update({ where: { id: existingLead.id }, data: { leadSourceId: source.id } })
      : await prisma.lead.create({ data: { sourceCompanyId: publisher.id, leadSourceId: source.id, externalId: item.externalId, fingerprint, status: "ALLOCATED", category: item.category, service: item.category, sourceWebsite: "https://source.example", postalCode: item.postcode, city: item.city, region: item.city === "Nijmegen" ? "Gelderland" : "Noord-Brabant", description: `Demo-aanvraag voor ${item.category.toLowerCase()}.`, consentAt: new Date(), contact: { name: item.name, email: `${item.externalId}@example.test`, phone: "0612345678" }, attributes: { developmentSeed: true } } });
    const rule = await prisma.pricingRule.findFirstOrThrow({ where: { companyId: buyer.id, category: item.category } });
    await prisma.allocation.upsert({ where: { companyId_leadId: { companyId: buyer.id, leadId: lead.id } }, update: {}, create: { companyId: buyer.id, leadId: lead.id, pricingRuleId: rule.id, status: "ACCEPTED", companyStatus: "NEW", score: 100, priceCents: item.price, currency: "EUR", acceptedAt: new Date(), priceSnapshot: { priceCents: item.price, currency: "EUR", category: item.category, developmentSeed: true } } });
  }

  const existingKey = await prisma.apiKey.findFirst({ where: { companyId: publisher.id, name: "Development ingest" } });
  if (existingKey) {
    await prisma.apiKey.update({ where: { id: existingKey.id }, data: { leadSourceId: source.id, scopes: ["leads:write"], status: "ACTIVE" } });
  } else {
    const created = await createApiKey({ companyId: publisher.id, leadSourceId: source.id, name: "Development ingest", hmacRequired: true });
    process.stdout.write(`Development ingest credentials (shown once):\nAPI key: ${created.rawKey}\nHMAC secret: ${created.hmacSecret}\n`);
  }
  process.stdout.write(`Seeded admin@linkconnect.test and mark@vandijk-installatie.test. Password: ${password}\n`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
