import { z } from "zod";

/** Ordered from least to most severe. Kept in sync with the worker's Go enum. */
export const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

export const severitySchema = z.enum(SEVERITIES);

export type Severity = z.infer<typeof severitySchema>;

export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITIES.indexOf(a) - SEVERITIES.indexOf(b);
}

export function isAtLeast(severity: Severity, threshold: Severity): boolean {
  return compareSeverity(severity, threshold) >= 0;
}
