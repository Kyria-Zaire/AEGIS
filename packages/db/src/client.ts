import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient } from "./generated/prisma/client";

const databaseUrlSchema = z
  .string({ error: "DATABASE_URL is not set" })
  .regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a postgres:// or postgresql:// URL");

export function createPrismaClient(databaseUrl: string | undefined = process.env.DATABASE_URL): PrismaClient {
  const connectionString = databaseUrlSchema.parse(databaseUrl);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reuse one client across Next.js dev hot reloads instead of leaking a connection pool per reload.
const globalForPrisma = globalThis as typeof globalThis & { __aegisPrisma?: PrismaClient };

/** Lazily created on first access so importing the package never requires DATABASE_URL (e.g. at build time). */
export function prisma(): PrismaClient {
  globalForPrisma.__aegisPrisma ??= createPrismaClient();
  return globalForPrisma.__aegisPrisma;
}
