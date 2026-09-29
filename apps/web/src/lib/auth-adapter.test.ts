/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@aegis/db";
import { createAegisAdapter } from "./auth-adapter";

describe("createAegisAdapter", () => {
  it("never passes OAuth tokens to Prisma linkAccount", async () => {
    const create = vi.fn(async ({ data }) => ({ ...data, access_token: null, refresh_token: null, id_token: null }));
    const db = { account: { create } } as unknown as PrismaClient;
    const adapter = createAegisAdapter(db);
    await adapter.linkAccount?.({
      userId: "user-id",
      type: "oauth",
      provider: "github",
      providerAccountId: "42",
      access_token: "must-not-persist",
      refresh_token: "must-not-persist",
      id_token: "must-not-persist",
    });
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty("access_token");
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty("refresh_token");
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty("id_token");
  });

  it("creates a personal workspace and OWNER membership in the user transaction", async () => {
    const userCreate = vi.fn(async ({ data }) => ({ ...data, id: "12345678-aaaa-bbbb-cccc-123456789abc" }));
    const organizationCreate = vi.fn(async () => ({}));
    const tx = { user: { create: userCreate }, organization: { create: organizationCreate } };
    const db = { $transaction: vi.fn(async (callback) => callback(tx)) } as unknown as PrismaClient;
    const adapter = createAegisAdapter(db);
    await adapter.createUser?.({ id: "ignored", name: "Ada", email: "ada@example.com", emailVerified: null, image: null });
    expect(organizationCreate).toHaveBeenCalledWith({
      data: {
        name: "Personal Workspace",
        slug: "personal-12345678",
        personalOwnerId: "12345678-aaaa-bbbb-cccc-123456789abc",
        memberships: { create: { userId: "12345678-aaaa-bbbb-cccc-123456789abc", role: "OWNER" } },
      },
    });
  });
});
