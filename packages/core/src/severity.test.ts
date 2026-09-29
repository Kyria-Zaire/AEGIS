import { describe, expect, it } from "vitest";

import { compareSeverity, isAtLeast, severitySchema } from "./severity";

describe("severity", () => {
  it("orders severities from info to critical", () => {
    expect(compareSeverity("critical", "high")).toBeGreaterThan(0);
    expect(compareSeverity("info", "low")).toBeLessThan(0);
    expect(compareSeverity("medium", "medium")).toBe(0);
  });

  it("checks thresholds inclusively", () => {
    expect(isAtLeast("high", "high")).toBe(true);
    expect(isAtLeast("critical", "medium")).toBe(true);
    expect(isAtLeast("low", "medium")).toBe(false);
  });

  it("rejects unknown severities", () => {
    expect(severitySchema.safeParse("urgent").success).toBe(false);
  });
});
