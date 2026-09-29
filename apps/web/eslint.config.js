import { FlatCompat } from "@eslint/eslintrc";

import { baseConfig } from "../../eslint.config.base.js";

// TODO(debt): eslint-config-next@15 is eslintrc-only and caps ESLint at v9 (EOL). Upgrading to Next 16
// gives a native flat config + ESLint 10 support — drop FlatCompat and @eslint/eslintrc then.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The generated Prisma client and @auth/prisma-adapter resolve differently on Windows and Linux:
    // TypeScript requires this cast locally while Linux ESLint otherwise reports it as unnecessary.
    files: ["src/lib/auth-adapter.ts"],
    rules: { "@typescript-eslint/no-unnecessary-type-assertion": "off" },
  },
];

export default config;
