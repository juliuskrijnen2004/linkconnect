import { ForbiddenError } from "@/lib/auth";

// API-key and Stripe routes authenticate independently and intentionally do not use this guard.
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = process.env.APP_URL
    ? new URL(process.env.APP_URL).origin
    : new URL(request.url).origin;
  // Unsafe browser requests always carry Origin. Missing Origin is rejected so a
  // cookie-authenticated form post cannot bypass the CSRF boundary.
  if (!origin || origin !== expectedOrigin) {
    throw new ForbiddenError();
  }
}
