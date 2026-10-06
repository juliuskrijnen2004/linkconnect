import Stripe from "stripe";

import { getServerEnv } from "@/lib/env";

let client: Stripe | undefined;

export function getStripe() {
  const { STRIPE_SECRET_KEY } = getServerEnv();
  if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
  client ??= new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
  return client;
}
