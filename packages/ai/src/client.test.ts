import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

import { ClaudeClient } from "./client";
import { ClaudeRefusalError, ClaudeTruncatedError } from "./errors";

interface StopInfo {
  stopReason: "end_turn" | "refusal" | "max_tokens";
  stopDetails?: { type: "refusal"; category: string; explanation: string };
}

/** Minimal Messages API SSE stream: one text block, then the given stop reason. */
function sseResponse(text: string, { stopReason, stopDetails }: StopInfo): Response {
  const events: [string, unknown][] = [
    [
      "message_start",
      {
        type: "message_start",
        message: {
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 0 },
        },
      },
    ],
    [
      "content_block_start",
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: stopReason, stop_sequence: null, stop_details: stopDetails ?? null },
        usage: { output_tokens: 7 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  ];
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function clientReturning(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  const sdk = new Anthropic({ apiKey: "test-key", fetch: fetchMock, maxRetries: 0 });
  return { claude: new ClaudeClient({}, sdk), fetchMock };
}

describe("ClaudeClient.complete", () => {
  it("returns the concatenated text and usage", async () => {
    const { claude, fetchMock } = clientReturning(sseResponse("hello", { stopReason: "end_turn" }));

    const result = await claude.complete({ prompt: "ping" });

    expect(result).toEqual({
      text: "hello",
      model: "claude-opus-5-5",
      usage: { inputTokens: 12, outputTokens: 7 },
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body;
    if (typeof body !== "string") throw new Error("expected a JSON string request body");
    const sent: unknown = JSON.parse(body);
    expect(sent).toMatchObject({
      model: "claude-opus-5-5",
      stream: true,
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    });
  });

  it("throws ClaudeRefusalError on refusal", async () => {
    const { claude } = clientReturning(
      sseResponse("", {
        stopReason: "refusal",
        stopDetails: { type: "refusal", category: "cyber", explanation: "declined" },
      }),
    );

    await expect(claude.complete({ prompt: "x" })).rejects.toMatchObject({
      name: ClaudeRefusalError.name,
      category: "cyber",
    });
  });

  it("throws ClaudeTruncatedError when max_tokens is hit", async () => {
    const { claude } = clientReturning(sseResponse("partial", { stopReason: "max_tokens" }));

    await expect(claude.complete({ prompt: "x", maxTokens: 10 })).rejects.toBeInstanceOf(
      ClaudeTruncatedError,
    );
  });
});
