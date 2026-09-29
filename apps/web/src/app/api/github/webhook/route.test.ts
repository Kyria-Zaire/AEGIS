/* eslint-disable @typescript-eslint/require-await */
import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/webhook", () => ({ processGithubWebhook: vi.fn(async () => "processed") }));

import { processGithubWebhook } from "@/lib/webhook";
import { POST } from "./route";

describe("GitHub webhook route", () => {
  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    vi.clearAllMocks();
  });

  it("returns 401 and performs no processing for an invalid signature", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "secret";
    const response = await POST(
      new Request("http://localhost/api/github/webhook", {
        method: "POST",
        body: "{}",
        headers: { "x-hub-signature-256": `sha256=${"0".repeat(64)}` },
      }),
    );
    expect(response.status).toBe(401);
    expect(processGithubWebhook).not.toHaveBeenCalled();
  });

  it("processes a valid signed delivery", async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "secret";
    const body = '{"action":"created"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    const response = await POST(
      new Request("http://localhost/api/github/webhook", {
        method: "POST",
        body,
        headers: {
          "x-hub-signature-256": signature,
          "x-github-event": "installation",
          "x-github-delivery": "delivery-1",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(processGithubWebhook).toHaveBeenCalledWith("installation", "delivery-1", { action: "created" });
  });
});
