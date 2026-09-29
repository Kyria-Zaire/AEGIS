import path from "node:path";

import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Single source of truth for local env: the monorepo root .env (CI/prod inject real env vars).
config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` doesn't need a connection; migrate/studio fail loudly if this is empty.
    url: process.env.DATABASE_URL ?? "",
  },
});
