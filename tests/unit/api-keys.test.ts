import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  apiKey: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  authenticateIngestRequest,
  createApiKey,
  createApiKeyMaterial,
} from "@/lib/api-keys";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

describe("API-key authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates one-way key material and enables HMAC by default for lead writes", async () => {
    const material = createApiKeyMaterial();
    prismaMock.apiKey.create.mockResolvedValue({ id: "key-1", companyId: "company-1" });

    const result = await createApiKey({
      companyId: "company-1",
      leadSourceId: "source-1",
      name: "Lead source",
    });
    const data = prismaMock.apiKey.create.mock.calls[0][0].data;

    expect(material.rawKey).toMatch(/^lc_live_[A-Za-z0-9_-]+$/);
    expect(material.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rawKey).toMatch(/^lc_live_/);
    expect(result.hmacSecret).toBeTypeOf("string");
    expect(data.hmacRequired).toBe(true);
    expect(data.hmacSecretEncrypted).toBeTypeOf("string");
    expect(decryptSecret(data.hmacSecretEncrypted)).toBe(result.hmacSecret);
  });

  it("accepts a fresh HMAC-signed request and records last use asynchronously", async () => {
    const rawKey = "lc_live_test-key";
    const secret = "test-hmac-secret";
    const encryptedSecret = encryptSecret(secret);
    const apiKey = {
      id: "key-1",
      companyId: "source-company",
      leadSourceId: "source-1",
      status: "ACTIVE",
      scopes: ["leads:write"],
      expiresAt: null,
      hmacRequired: true,
      hmacSecretEncrypted: encryptedSecret,
      company: { id: "source-company", status: "ACTIVE" },
      leadSource: { id: "source-1", companyId: "source-company", domain: "source.example", status: "ACTIVE", allowedCategorySlugs: [], allowedServices: [] },
    };
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKey);
    prismaMock.apiKey.update.mockResolvedValue(apiKey);
    const body = '{"lead":"payload"}';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`, "utf8")
      .digest("hex");
    const headers = new Headers({
      "x-api-key": rawKey,
      "x-linkconnect-timestamp": timestamp,
      "x-linkconnect-signature": signature,
    });

    await expect(authenticateIngestRequest(headers, body)).resolves.toEqual(expect.objectContaining({
      ...apiKey,
      replay: expect.objectContaining({
        replayKey: expect.stringMatching(/^[a-f0-9]{64}$/),
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      }),
    }));
    expect(prismaMock.apiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { keyHash: expect.stringMatching(/^[a-f0-9]{64}$/) },
    }));
    expect(prismaMock.apiKey.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "key-1" },
    }));
  });

  it("rejects invalid HMAC signatures and expired keys", async () => {
    const apiKey = {
      id: "key-1",
      companyId: "source-company",
      leadSourceId: "source-1",
      status: "ACTIVE",
      scopes: ["leads:write"],
      expiresAt: null,
      hmacRequired: true,
      hmacSecretEncrypted: encryptSecret("test-hmac-secret"),
      company: { id: "source-company", status: "ACTIVE" },
      leadSource: { id: "source-1", companyId: "source-company", domain: "source.example", status: "ACTIVE", allowedCategorySlugs: [], allowedServices: [] },
    };
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKey);
    const headers = new Headers({
      "x-api-key": "lc_live_test-key",
      "x-linkconnect-timestamp": Math.floor(Date.now() / 1000).toString(),
      "x-linkconnect-signature": "0".repeat(64),
    });

    await expect(authenticateIngestRequest(headers, "{}")) .resolves.toBeNull();
    expect(prismaMock.apiKey.update).not.toHaveBeenCalled();

    prismaMock.apiKey.findUnique.mockResolvedValue({
      ...apiKey,
      expiresAt: new Date(Date.now() - 1_000),
    });
    await expect(authenticateIngestRequest(new Headers({ "x-api-key": "lc_live_test-key" }), "{}"))
      .resolves.toBeNull();
  });

  it("fails closed when a legacy leads:write key has no HMAC secret", async () => {
    const apiKey = {
      id: "key-1",
      companyId: "source-company",
      leadSourceId: "source-1",
      status: "ACTIVE",
      scopes: ["leads:write"],
      expiresAt: null,
      hmacRequired: false,
      hmacSecretEncrypted: null,
      company: { id: "source-company", status: "ACTIVE" },
      leadSource: { id: "source-1", companyId: "source-company", domain: "source.example", status: "ACTIVE", allowedCategorySlugs: [], allowedServices: [] },
    };
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKey);

    await expect(authenticateIngestRequest(new Headers({ "x-api-key": "lc_live_test-key" }), "{}"))
      .resolves.toBeNull();
  });

  it("rejects credentials without the lead-write scope or an active source", async () => {
    const apiKey = {
      id: "key-1",
      companyId: "source-company",
      leadSourceId: "source-1",
      status: "ACTIVE",
      scopes: ["leads:read"],
      expiresAt: null,
      hmacRequired: false,
      hmacSecretEncrypted: null,
      company: { id: "source-company", status: "ACTIVE" },
      leadSource: { id: "source-1", companyId: "source-company", domain: "source.example", status: "ACTIVE", allowedCategorySlugs: [], allowedServices: [] },
    };
    prismaMock.apiKey.findUnique.mockResolvedValue(apiKey);
    await expect(authenticateIngestRequest(new Headers({ "x-api-key": "lc_live_test-key" }), "{}"))
      .resolves.toBeNull();

    prismaMock.apiKey.findUnique.mockResolvedValue({
      ...apiKey,
      scopes: ["leads:write"],
      leadSource: { ...apiKey.leadSource, status: "PAUSED" },
    });
    await expect(authenticateIngestRequest(new Headers({ "x-api-key": "lc_live_test-key" }), "{}"))
      .resolves.toBeNull();

    prismaMock.apiKey.findUnique.mockResolvedValue({
      ...apiKey,
      scopes: ["leads:write"],
      company: { ...apiKey.company, status: "PAUSED" },
      leadSource: { ...apiKey.leadSource, status: "ACTIVE" },
    });
    await expect(authenticateIngestRequest(new Headers({ "x-api-key": "lc_live_test-key" }), "{}"))
      .resolves.toBeNull();
  });
});
