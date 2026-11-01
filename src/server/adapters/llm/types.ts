import type { ZodType } from "zod";

export type LlmRoute = "discovery.turn" | "discovery.rerank" | "search.query_understanding";

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Stable blocks (system prompt, taxonomy) first so providers can cache them. */
export type ContextBlock = { id: string; text: string; cacheable: boolean };

export type LlmUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export interface LlmProvider {
  readonly id: string;
  generateStructured<T>(request: {
    route: LlmRoute;
    system: string;
    context: ContextBlock[];
    messages: ChatMessage[];
    schema: ZodType<T>;
    maxOutputTokens: number;
    signal?: AbortSignal;
  }): Promise<{ data: T; usage: LlmUsage; model: string; stopReason: string }>;
}
