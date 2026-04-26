/**
 * Shared types used by every LLM router provider.
 * Lives here (and not in `../llm-router.ts`) so providers can import it
 * without creating an import cycle with the router itself.
 */

export interface LLMAttachment {
  type: "image" | "doc";
  url: string;
}

export interface ProviderInvokeArgs {
  systemPrompt?: string;
  userPrompt: string;
  maxTokens: number;
  temperature?: number;
  attachments?: LLMAttachment[];
}

export interface ProviderInvokeResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
