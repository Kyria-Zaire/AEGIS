import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { ClaudeRefusalError, ClaudeTruncatedError } from "./errors";
import { DEFAULT_EFFORT, DEFAULT_MODEL, type Effort } from "./models";

const optionsSchema = z.object({
  /** Falls back to the SDK credential chain (ANTHROPIC_API_KEY, `ant auth login` profile…) when omitted. */
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1).default(DEFAULT_MODEL),
  /** SDK retries 408/409/429/5xx and connection errors with backoff. */
  maxRetries: z.number().int().min(0).max(10).default(2),
  /** Per-attempt timeout in milliseconds. */
  timeoutMs: z
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
});

export type ClaudeClientOptions = z.input<typeof optionsSchema>;

export interface CompleteParams {
  system?: string;
  prompt: string;
  maxTokens?: number;
  effort?: Effort;
  signal?: AbortSignal;
}

export interface Completion {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

const DEFAULT_MAX_TOKENS = 64_000;

/** Server-side refusal fallback: the API reroutes a declined request itself, by refusal category. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class ClaudeClient {
  readonly #client: Anthropic;
  readonly #model: string;

  constructor(options: ClaudeClientOptions = {}, client?: Anthropic) {
    const { apiKey, model, maxRetries, timeoutMs } = optionsSchema.parse(options);
    this.#model = model;
    this.#client = client ?? new Anthropic({ ...(apiKey ? { apiKey } : {}), maxRetries, timeout: timeoutMs });
  }

  /**
   * Single-turn text completion. Streams under the hood (large max_tokens would otherwise hit HTTP
   * timeouts) and resolves with the final message. Throws ClaudeRefusalError / ClaudeTruncatedError
   * for unusable outputs, and the SDK's typed Anthropic.APIError subclasses for transport failures.
   */
  async complete({
    system,
    prompt,
    maxTokens = DEFAULT_MAX_TOKENS,
    effort = DEFAULT_EFFORT,
    signal,
  }: CompleteParams): Promise<Completion> {
    const stream = this.#client.beta.messages.stream(
      {
        model: this.#model,
        max_tokens: maxTokens,
        betas: [FALLBACK_BETA],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort },
        ...(system ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
      },
      signal ? { signal } : {},
    );
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      throw new ClaudeRefusalError(
        message.stop_details?.category ?? null,
        message.stop_details?.explanation ?? null,
      );
    }
    if (message.stop_reason === "max_tokens") {
      throw new ClaudeTruncatedError(maxTokens);
    }

    const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");

    return {
      text,
      model: message.model,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    };
  }
}
