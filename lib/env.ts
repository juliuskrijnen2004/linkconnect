import { z } from "zod";

const serverEnvSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(32),
  DATA_ENCRYPTION_KEY: z.string().min(40),
  DATABASE_URL: z.string().url(),
  APP_URL: z.string().url().optional(),
  CRON_SECRET: z.string().min(32).optional(),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  EMAIL_FROM: z.string().min(3).max(320).optional(),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    APP_URL: process.env.APP_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
  });
}
