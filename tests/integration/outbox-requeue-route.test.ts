import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requeue: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ CRON_SECRET: "a-test-cron-secret-with-more-than-32-characters" }),
}));
vi.mock("@/lib/outbox", () => ({
  requeueFailedOutboxEvent: routeMocks.requeue,
}));

import { POST } from "@/app/api/internal/outbox/requeue/route";

const eventId = "00000000-0000-4000-8000-000000000001";

describe("POST /api/internal/outbox/requeue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.requeue.mockResolvedValue(true);
  });

  it("requires the operations secret", async () => {
    const response = await POST(new Request("https://linkconnect.test/api/internal/outbox/requeue", {
      method: "POST",
      body: JSON.stringify({ eventId }),
    }));

    expect(response.status).toBe(401);
    expect(routeMocks.requeue).not.toHaveBeenCalled();
  });

  it("requeues a failed event with the operations secret", async () => {
    const response = await POST(new Request("https://linkconnect.test/api/internal/outbox/requeue", {
      method: "POST",
      headers: { authorization: "Bearer a-test-cron-secret-with-more-than-32-characters" },
      body: JSON.stringify({ eventId }),
    }));

    expect(response.status).toBe(200);
    expect(routeMocks.requeue).toHaveBeenCalledWith(eventId);
    expect(await response.json()).toEqual({ requeued: true });
  });
});
