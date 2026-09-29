/** Claude declined the request (stop_reason "refusal"), after any server-side fallback also declined. */
export class ClaudeRefusalError extends Error {
  constructor(
    public readonly category: string | null,
    public readonly explanation: string | null,
  ) {
    super(`Claude refused the request${category ? ` (category: ${category})` : ""}`);
    this.name = "ClaudeRefusalError";
  }
}

/** Output hit max_tokens: the text is incomplete and must not be treated as a final answer. */
export class ClaudeTruncatedError extends Error {
  constructor(public readonly maxTokens: number) {
    super(`Claude output truncated at max_tokens=${maxTokens}`);
    this.name = "ClaudeTruncatedError";
  }
}
