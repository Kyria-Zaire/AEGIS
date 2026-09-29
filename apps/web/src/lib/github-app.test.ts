import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "./github-app";

describe("verifyWebhookSignature", () => {
  beforeEach(() => { process.env.GITHUB_WEBHOOK_SECRET = "test-secret"; });
  afterEach(() => { delete process.env.GITHUB_WEBHOOK_SECRET; });

  it("accepts a valid signature", () => {
    const payload = '{"zen":"secure"}';
    const signature = `sha256=${createHmac("sha256", "test-secret").update(payload).digest("hex")}`;
    expect(verifyWebhookSignature(payload, signature)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(verifyWebhookSignature("payload", `sha256=${"0".repeat(64)}`)).toBe(false);
  });

  it.each([null, "", "sha1=abc", "sha256=xyz"])("rejects malformed signature %s", (signature) => {
    expect(verifyWebhookSignature("payload", signature)).toBe(false);
  });
});
