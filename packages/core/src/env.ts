import type { z } from "zod";

export class EnvValidationError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Invalid environment variables:\n  - ${issues.join("\n  - ")}`);
    this.name = "EnvValidationError";
  }
}

/**
 * Validates environment variables against a schema and fails fast with every problem at once.
 * Only variable names are reported — values are never echoed, so secrets can't leak into logs.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    );
  }
  return parsed.data;
}
