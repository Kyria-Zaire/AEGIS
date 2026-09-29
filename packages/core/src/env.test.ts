import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EnvValidationError, parseEnv } from "./env";

const schema = z.object({
  DATABASE_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
});

describe("parseEnv", () => {
  it("returns typed, coerced values", () => {
    const env = parseEnv(schema, { DATABASE_URL: "postgresql://localhost/db", PORT: "8080" });
    expect(env).toEqual({ DATABASE_URL: "postgresql://localhost/db", PORT: 8080 });
  });

  it("reports every invalid variable without leaking values", () => {
    const secret = "not-a-url-but-maybe-a-secret";
    const run = () => parseEnv(schema, { DATABASE_URL: secret, PORT: "-1" });

    expect(run).toThrow(EnvValidationError);
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const { issues, message } = error as EnvValidationError;
      expect(issues).toHaveLength(2);
      expect(message).not.toContain(secret);
    }
  });
});
