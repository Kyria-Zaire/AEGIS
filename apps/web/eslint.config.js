import { FlatCompat } from "@eslint/eslintrc";

import { baseConfig } from "../../eslint.config.base.js";

// TODO(debt): eslint-config-next@15 is eslintrc-only and caps ESLint at v9 (EOL). Upgrading to Next 16
// gives a native flat config + ESLint 10 support — drop FlatCompat and @eslint/eslintrc then.
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...baseConfig({ tsconfigRootDir: import.meta.dirname }),
];

export default config;
