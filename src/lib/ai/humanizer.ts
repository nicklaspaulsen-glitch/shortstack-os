/**
 * AI Output Humanizer
 *
 * Two-stage pass that strips "AI tells" from generated text:
 *   1. preHumanize() — fast, deterministic regex substitutions. Cheap.
 *   2. humanize()    — LLM rewrite via the cheap-tier router (Haiku-class)
 *                      after preHumanize, only for content surfaces that
 *                      justify the token spend.
 *
 * The humanizer is OPT-IN at the wrapper level — `callLLMHumanized` flips
 * humanize on by default for content surfaces, off for analysis surfaces.
 *
 * Goals:
 *   - Eliminate "as an AI", "delve into", "tapestry", corporate hedges.
 *   - Encourage contractions and varied sentence length.
 *   - Optionally inject a voice snippet learned from the user's own writing.
 *
 * Anti-goals:
 *   - Don't change facts. Don't translate.
 *   - Don't grow output length (humans tend to be ~90% as long).
 */
import type { LLMRequest } from "./llm-router";

/**
 * Banned-phrase regex pre-pass. Fast removal of common AI tells. Each
 * pattern is run in order; later patterns see earlier substitutions.
 */
const BANNED_PATTERNS: Array<{
  pattern: RegExp;
  replacement: string | ((m: string) => string);
}> = [
  // Corporate hedges and "it's important to note" framing.
  { pattern: /\bIt['’]s important to note (that )?/gi, replacement: "" },
  { pattern: /\bIn essence,?\s*/gi, replacement: "" },
  { pattern: /\bAt its core,?\s*/gi, replacement: "" },
  { pattern: /\bFurthermore,?\s*/gi, replacement: "" },
  { pattern: /\bMoreover,?\s*/gi, replacement: "" },
  { pattern: /\bAdditionally,?\s*/gi, replacement: "Also, " },
  // AI vocabulary tells — common LLM word choices that read as "robot".
  // Stem-matched so "leveraging", "harnesses", "navigated" all get caught.
  { pattern: /\bdelve(s|d|ing)? into\b/gi, replacement: "dig into" },
  { pattern: /\btapestry\b/gi, replacement: "mix" },
  { pattern: /\brobust(ly|ness)?\b/gi, replacement: "solid" },
  { pattern: /\bnavigat(e|es|ed|ing)\b/gi, replacement: (m) => m.endsWith("ing") ? "handling" : m.endsWith("ed") ? "handled" : m.endsWith("es") ? "handles" : "handle" },
  { pattern: /\bleverag(e|es|ed|ing)\b/gi, replacement: (m) => m.endsWith("ing") ? "using" : m.endsWith("ed") ? "used" : m.endsWith("es") ? "uses" : "use" },
  { pattern: /\bharness(es|ed|ing)?\b/gi, replacement: (m) => m.endsWith("ing") ? "using" : m.endsWith("ed") ? "used" : m.endsWith("es") ? "uses" : "use" },
  { pattern: /\bin the realm of\b/gi, replacement: "in" },
  // Identity hedges — assistants outing themselves mid-message.
  { pattern: /\bAs an AI( assistant)?,?\s*/gi, replacement: "" },
  { pattern: /\bI cannot,? but I can\b/gi, replacement: "I can" },
  // Tricolons ("not just X, not just Y, but Z") — AI loves these.
  {
    pattern: /\bnot just (\w+),?\s+not just (\w+),?\s+but (\w+)\b/gi,
    replacement: "$1, $2, and $3",
  },
];

/**
 * Fast deterministic pass. Runs every banned-phrase regex, then collapses
 * leftover whitespace and any orphan punctuation produced by removals.
 * Pure function — safe to call from anywhere, no I/O.
 */
export function preHumanize(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { pattern, replacement } of BANNED_PATTERNS) {
    out = typeof replacement === "string"
      ? out.replace(pattern, replacement)
      : out.replace(pattern, replacement);
  }
  // Collapse double spaces left by removals; tighten whitespace before
  // punctuation. Trim leading/trailing whitespace produced by leading-prefix
  // removals like "Furthermore, ".
  return out.replace(/[ \t]+/g, " ").replace(/\s+([.,!?;])/g, "$1").trim();
}

export interface HumanizeOptions {
  /** Voice snippet pulled from a writing_voice_profiles row. Optional. */
  voiceSnippet?: string;
  /** Channel hint — tunes brevity / informality of the rewrite. */
  channel?: "email" | "sms" | "dm" | "social" | "voice_script" | "doc";
  /** Pass-through user id for usage tracking on the LLM call. */
  userId?: string;
  /** Override max tokens. Defaults to ~half the input length in tokens. */
  maxTokens?: number;
}

const HUMANIZE_SYSTEM_PROMPT_BASE =
  "Rewrite this message to sound human, not AI-generated. Rules:\n" +
  "- Use contractions naturally (don't, you're, it's, won't)\n" +
  "- Vary sentence length (short ones are fine - even fragments)\n" +
  "- Cut corporate hedges and \"it's important to note\" framing\n" +
  "- Drop em-dash overuse (max 1-2 per message)\n" +
  "- Sound like a real person typing, not a corporate template\n" +
  "- Keep all factual content; only change voice\n" +
  "Return ONLY the rewritten text. No preamble. No explanation.";

/**
 * Deep humanization pass. Runs preHumanize first (always, deterministic) and
 * then optionally rewrites the result through the cheap-tier LLM.
 *
 * Skips the LLM for very short text or SMS — the regex pass + the input prompt
 * (which already produced something) carry the load. Always falls back to the
 * pre-humanized text on any LLM failure so callers never see an empty body.
 */
export async function humanize(
  text: string,
  opts: HumanizeOptions = {},
): Promise<string> {
  if (!text) return text;
  const pre = preHumanize(text);
  // Tiny payloads / SMS — the regex pass is enough; the LLM cost isn't worth it.
  if (pre.length < 80 || opts.channel === "sms") return pre;

  const channelHint = opts.channel ? `\nChannel: ${opts.channel}` : "";
  const voiceHint = opts.voiceSnippet
    ? `\n\nVOICE TO MATCH:\n${opts.voiceSnippet}`
    : "";
  const systemPrompt = HUMANIZE_SYSTEM_PROMPT_BASE + voiceHint + channelHint;

  // Lazy import — the router pulls Anthropic/OpenAI/etc. and we want to keep
  // preHumanize() callable from any context (incl. tests) without a router init.
  let callLLM: ((r: LLMRequest) => Promise<{ text: string }>) | null = null;
  try {
    const mod = await import("./llm-router");
    callLLM = mod.callLLM;
  } catch (err) {
    console.warn("[humanizer] llm-router unavailable, returning preHumanize result", err);
    return pre;
  }

  // approx chars→tokens (4 chars/token) and round up; default cap mirrors the
  // input so the rewrite can't balloon length.
  const estTokens = Math.max(120, Math.ceil(pre.length / 2.5));
  const maxTokens = opts.maxTokens ?? estTokens;

  try {
    const result = await callLLM({
      taskType: "simple_classification", // routes to Haiku-class via llm-router
      systemPrompt,
      userPrompt: pre,
      maxTokens,
      temperature: 0.6,
      userId: opts.userId,
      context: "/lib/ai/humanizer",
    });
    const out = (result.text || "").trim();
    return out.length > 0 ? out : pre;
  } catch (err) {
    console.warn("[humanizer] LLM rewrite failed, falling back to preHumanize", err);
    return pre;
  }
}

/** Exposed for tests — the banned-phrase list, read-only. */
export function getBannedPatternsCount(): number {
  return BANNED_PATTERNS.length;
}
