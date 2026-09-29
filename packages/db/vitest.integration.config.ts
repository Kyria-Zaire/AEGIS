import path from "node:path";

import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Local runs read the monorepo root .env; CI provides DATABASE_URL directly (existing vars are never overridden).
config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    // Tests share one database: run files sequentially to keep them independent.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
