import { describe, expect, it } from "vitest";

import { createPrismaClient } from "./client";

describe("createPrismaClient", () => {
  it("rejects a missing DATABASE_URL", () => {
    expect(() => createPrismaClient(undefined)).toThrow(/DATABASE_URL is not set/);
  });

  it("rejects a non-postgres URL", () => {
    expect(() => createPrismaClient("mysql://localhost/db")).toThrow(/postgres/);
  });

  it("builds a client without connecting eagerly", async () => {
    const client = createPrismaClient("postgresql://user:pass@localhost:5432/db");
    expect(client).toBeDefined();
    await client.$disconnect();
  });
});
