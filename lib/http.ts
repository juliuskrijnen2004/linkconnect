import { ZodError } from "zod";

import { ForbiddenError, UnauthorizedError } from "@/lib/auth";

export function errorResponse(error: unknown) {
  if (error instanceof RateLimitError) {
    return Response.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } },
    );
  }
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) {
    return Response.json({ error: "Invalid request", issues: error.flatten() }, { status: 400 });
  }
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error("Unhandled request failure", {
    type: error instanceof Error ? error.name : typeof error,
  });
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) { super(message, 400); }
}

export class NotFoundError extends HttpError {
  constructor(message: string) { super(message, 404); }
}

export class ConflictError extends HttpError {
  constructor(message: string) { super(message, 409); }
}

export class RateLimitError extends HttpError {
  constructor(readonly retryAfterSeconds: number) { super("Too many requests", 429); }
}
