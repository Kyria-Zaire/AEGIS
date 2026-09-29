/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@aegis/db";

vi.mock("./github-app", () => ({
  getInstallationOctokit: vi.fn(async () => ({
    paginate: vi.fn(async () => [{ id: 99, full_name: "acme/api", default_branch: "main", private: true }]),
    rest: { apps: { listReposAccessibleToInstallation: vi.fn() } },
  })),
}));

import { processGithubWebhook } from "./webhook";

describe("processGithubWebhook", () => {
  it("creates an installation and its repositories", async () => {
    const repositoryUpsert = vi.fn(async () => ({}));
    const tx = {
      webhookDelivery: { create: vi.fn(async () => ({})) },
      account: { findUnique: vi.fn(async () => ({ user: { memberships: [{ organizationId: "org-1" }] } })) },
      githubInstallation: { upsert: vi.fn(async () => ({ id: "installation-row" })) },
      repository: { upsert: repositoryUpsert },
    };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) } as unknown as PrismaClient;
    const result = await processGithubWebhook("installation", "delivery-1", {
      action: "created",
      sender: { id: 7 },
      installation: { id: 42, account: { id: 7, login: "acme", type: "Organization" } },
    }, db);
    expect(result).toBe("processed");
    expect(tx.githubInstallation.upsert).toHaveBeenCalledOnce();
    expect(repositoryUpsert).toHaveBeenCalledOnce();
  });

  it("treats a repeated delivery as a no-op", async () => {
    const duplicate = Object.assign(new Error("unique"), { code: "P2002" });
    const db = { $transaction: vi.fn(async () => { throw duplicate; }) } as unknown as PrismaClient;
    await expect(processGithubWebhook("push", "delivery-1", {}, db)).resolves.toBe("duplicate");
  });
});
