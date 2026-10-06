import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { getServerEnv } from "@/lib/env";

const CIPHER = "aes-256-gcm";

function encryptionKey() {
  const key = Buffer.from(getServerEnv().DATA_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(serialized: string) {
  const [ivPart, tagPart, ciphertextPart] = serialized.split(".");
  if (!ivPart || !tagPart || !ciphertextPart) {
    throw new Error("Malformed encrypted secret");
  }

  const decipher = createDecipheriv(CIPHER, encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
