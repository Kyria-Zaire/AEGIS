/** Default model for every Aegis call unless a caller explicitly picks another one. */
export const DEFAULT_MODEL = "claude-opus-5-5";

/** Opus 5.5 defaults to "medium"; we set it explicitly so behaviour doesn't drift with model defaults. */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const DEFAULT_EFFORT: Effort = "high";
