import path from "node:path";

import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

const monorepoRoot = path.resolve(process.cwd(), "../..");

// Load the monorepo root .env (single source of truth for local dev). Next only reads apps/web/.env by default.
loadEnvConfig(monorepoRoot);

const nextConfig: NextConfig = {
  // Pin the workspace root: Next otherwise guesses from the first lockfile found up the tree.
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  poweredByHeader: false,
  reactStrictMode: true,
  // Internal packages ship TypeScript sources; Next compiles them.
  transpilePackages: ["@aegis/ai", "@aegis/core", "@aegis/db"],
  typedRoutes: true,
  experimental: {
    // `radix-ui` is a barrel package: without this every primitive lands in the client bundle.
    optimizePackageImports: ["radix-ui"],
  },
};

export default nextConfig;
