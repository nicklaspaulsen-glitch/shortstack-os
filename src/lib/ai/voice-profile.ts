/**
 * Writing voice profile builder.
 *
 * - `captureVoiceSample(...)` ingests a single text sample into
 *   `writing_voice_corpus`. Skips trivial / empty samples. Always
 *   service-role — meant to be called fire-and-forget from send routes
 *   and inbound webhooks so user-facing latency is unaffected.
 *
 * - `getVoiceSnippet({ subjectKind, subjectId })` returns the cached
 *   `prompt_snippet` if the corpus has crossed the minimum-words
 *   threshold; otherwise returns `null` (don't apply voice if we can't
 *   trust it).
 *
 * - `recomputeVoiceProfile(...)` reads recent corpus rows, computes
 *   deterministic stats, asks Haiku for the qualitative bits
 *   (signature phrases / openings / closings / tone / prompt snippet),
 *   and upserts the row.
 *
 * Capture is FIRE-AND-FORGET. Profile build runs from the cron handler.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { safeJsonParse } from "@/lib/ai/claude-helpers";
import {
  computeStats as computeStatsImpl,
  countWords as countWordsImpl,
  VOICE_MIN_CORPUS_WORDS as VOICE_MIN_CORPUS_WORDS_IMPL,
} from "@/lib/ai/voice-profile-stats";

export type VoiceSubjectKind = "user" | "client" | "team_member";

export interface CaptureVoiceSampleArgs {
  agencyOwnerId: string;
  subjectKind: VoiceSubjectKind;
  subjectId: string;
  source: string;
  body: string;
  channel?: string;
}

export interface VoiceSubject {
  subjectKind: VoiceSubjectKind | string;
  subjectId: string;
}

export interface VoiceProfileRow {
  id: string;
  agency_owner_id: string;
  subject_kind: string;
  subject_id: string;
  corpus_size_words: number;
  formality_score: number | null;
  avg_sentence_length: number | null;
  contraction_rate: number | null;
  emoji_rate: number | null;
  em_dash_rate: number | null;
  exclamation_rate: number | null;
  signature_phrases: string[] | null;
  signature_openings: string[] | null;
  signature_closings: string[] | null;
  tone_keywords: string[] | null;
  vocabulary_signature: Record<string, unknown> | null;
  prompt_snippet: string | null;
  computed_at: string;
  corpus_size_at_computation: number;
}

/**
 * Minimum-words gate: don't apply a voice profile until we've seen at least
 * this many words from the subject. Below this, the profile would over-fit
 * tiny samples and produce worse output than the default Claude voice.
 *
 * Re-exported from `voice-profile-stats` so callers can keep importing
 * from one place.
 */
export const VOICE_MIN_CORPUS_WORDS = VOICE_MIN_CORPUS_WORDS_IMPL;

/** Per-sample cap to keep storage bounded. */
const SAMPLE_BODY_CHAR_CAP = 8000;

/** Min word count for a sample to be useful. Below this it's noise. */
const SAMPLE_MIN_WORDS = 5;

const countWords = countWordsImpl;

/**
 * Persist one voice sample into `writing_voice_corpus`. Trims the body to
 * `SAMPLE_BODY_CHAR_CAP`, drops samples shorter than `SAMPLE_MIN_WORDS`,
 * and never throws on storage failure (callers use this fire-and-forget).
 */
export async function captureVoiceSample(
  args: CaptureVoiceSampleArgs,
): Promise<void> {
  if (!args.body) return;
  const wordCount = countWords(args.body);
  if (wordCount < SAMPLE_MIN_WORDS) return;

  const supabase = createServiceClient();
  const { error } = await supabase.from("writing_voice_corpus").insert({
    agency_owner_id: args.agencyOwnerId,
    subject_kind: args.subjectKind,
    subject_id: args.subjectId,
    source: args.source,
    body: args.body.slice(0, SAMPLE_BODY_CHAR_CAP),
    channel: args.channel ?? null,
    word_count: wordCount,
  });
  if (error) {
    console.warn("[voice-profile] capture failed:", error.message);
  }
}

/**
 * Return the LLM-injectable voice snippet for a subject. Returns `null` if
 * the subject doesn't have a stored profile yet, or if the corpus is below
 * the minimum-words threshold.
 */
export async function getVoiceSnippet(
  subject: VoiceSubject,
): Promise<string | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("writing_voice_profiles")
    .select("prompt_snippet, corpus_size_words")
    .eq("subject_kind", subject.subjectKind)
    .eq("subject_id", subject.subjectId)
    .maybeSingle();

  if (error) {
    console.warn("[voice-profile] getVoiceSnippet error:", error.message);
    return null;
  }
  if (!data) return null;
  if ((data.corpus_size_words ?? 0) < VOICE_MIN_CORPUS_WORDS) return null;
  return (data.prompt_snippet || "").trim() || null;
}

/** Read the full profile row (used by Settings + client-detail pages). */
export async function getVoiceProfile(
  subject: VoiceSubject,
): Promise<VoiceProfileRow | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("writing_voice_profiles")
    .select("*")
    .eq("subject_kind", subject.subjectKind)
    .eq("subject_id", subject.subjectId)
    .maybeSingle();

  if (error) {
    console.warn("[voice-profile] getVoiceProfile error:", error.message);
    return null;
  }
  return (data as VoiceProfileRow | null) ?? null;
}

// ─── Deterministic stats — implementation lives in voice-profile-stats.ts ───
const computeStats = computeStatsImpl;

// ─── Qualitative LLM extraction ─────────────────────────────────────────

interface QualitativeExtraction {
  signaturePhrases: string[];
  signatureOpenings: string[];
  signatureClosings: string[];
  toneKeywords: string[];
  promptSnippet: string;
  vocabularySignature: Record<string, number>;
}

interface RawExtraction {
  signature_phrases?: unknown;
  signature_openings?: unknown;
  signature_closings?: unknown;
  tone_keywords?: unknown;
  prompt_snippet?: unknown;
  vocabulary_signature?: unknown;
}

const QUALITATIVE_SYSTEM_PROMPT = `You are a writing-voice analyst. Read the samples below and extract the writer's distinctive voice.

Return strict JSON, no prose, no fences:
{
  "signature_phrases": [string],     // 3-8 phrases the writer uses repeatedly
  "signature_openings": [string],    // 2-5 ways they start messages
  "signature_closings": [string],    // 2-5 ways they sign off
  "tone_keywords": [string],         // 3-6 short labels: 'energetic', 'blunt', 'warm', 'ironic', 'professional', etc.
  "vocabulary_signature": { "<word>": <count>, ... },   // 8-15 distinctive words/phrases with counts
  "prompt_snippet": string           // 1-2 paragraphs to inject into LLM system prompts so future generations sound like THIS writer. Speak ABOUT the writer in 3rd person ("They tend to...") and end with a 1-line directive.
}

Rules:
- Quote signature phrases EXACTLY as they appear (don't paraphrase).
- Don't fabricate. If the samples are too short for a slot, return [] for that slot.
- prompt_snippet must be useful as system-prompt injection: concrete, terse, no fluff.`;

function asStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 200))
    .slice(0, max);
}

function asVocabSignature(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const obj = value as Record<string, unknown>;
  const out: Record<string, number> = {};
  let count = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (count >= 20) break;
    if (typeof k !== "string" || k.length === 0) continue;
    const num = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(num)) continue;
    out[k.slice(0, 80)] = Math.round(num);
    count += 1;
  }
  return out;
}

async function extractQualitative(
  samples: string[],
  agencyOwnerId: string,
): Promise<QualitativeExtraction> {
  const userPrompt = [
    "Analyse the writer's voice from these samples (one per blank-line-separated block):",
    "",
    samples.slice(0, 30).join("\n---\n"),
    "",
    "Return the JSON now.",
  ].join("\n");

  let parsed: RawExtraction | null = null;
  try {
    const result = await callLLMTraced({
      surface: "voice_profile_qualitative",
      humanize: false,
      taskType: "simple_classification",
      systemPrompt: QUALITATIVE_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.2,
      userId: agencyOwnerId,
      context: "/lib/ai/voice-profile#extractQualitative",
    });
    parsed = safeJsonParse<RawExtraction>(result.text);
  } catch (err) {
    console.warn("[voice-profile] qualitative extraction failed", err);
  }

  return {
    signaturePhrases: asStringArray(parsed?.signature_phrases, 12),
    signatureOpenings: asStringArray(parsed?.signature_openings, 8),
    signatureClosings: asStringArray(parsed?.signature_closings, 8),
    toneKeywords: asStringArray(parsed?.tone_keywords, 10),
    vocabularySignature: asVocabSignature(parsed?.vocabulary_signature),
    promptSnippet:
      typeof parsed?.prompt_snippet === "string"
        ? (parsed.prompt_snippet as string).trim().slice(0, 1500)
        : "",
  };
}

// ─── Public recompute entrypoint ────────────────────────────────────────

export interface RecomputeArgs {
  agencyOwnerId: string;
  subjectKind: VoiceSubjectKind;
  subjectId: string;
  /** Override max samples to fetch. Default 100. */
  sampleLimit?: number;
}

export interface RecomputeResult {
  ok: boolean;
  reason?: string;
  corpusSizeWords?: number;
}

/**
 * Read the most-recent voice samples for a subject, compute stats + LLM
 * extraction, upsert into `writing_voice_profiles`. Tolerant of empty
 * corpora — returns `{ ok: false, reason }` instead of throwing.
 */
export async function recomputeVoiceProfile(
  args: RecomputeArgs,
): Promise<RecomputeResult> {
  const limit = Math.max(10, Math.min(args.sampleLimit ?? 100, 200));
  const supabase = createServiceClient();
  return recomputeVoiceProfileWithClient(supabase, args, limit);
}

/** Same as recomputeVoiceProfile but accepts an injected client (for cron). */
export async function recomputeVoiceProfileWithClient(
  supabase: SupabaseClient,
  args: RecomputeArgs,
  limit = 100,
): Promise<RecomputeResult> {
  const { data: rows, error } = await supabase
    .from("writing_voice_corpus")
    .select("body, word_count")
    .eq("subject_kind", args.subjectKind)
    .eq("subject_id", args.subjectId)
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.warn("[voice-profile] corpus fetch failed:", error.message);
    return { ok: false, reason: "corpus_fetch_failed" };
  }
  if (!rows || rows.length === 0) {
    return { ok: false, reason: "empty_corpus" };
  }

  const samples = (rows as Array<{ body: string; word_count: number }>)
    .map((r) => r.body)
    .filter((b) => typeof b === "string" && b.length > 0);

  const stats = computeStats(samples);
  // Below the threshold we still write a row so the cron knows it ran, but
  // we skip the qualitative LLM call (waste of tokens).
  let qualitative: QualitativeExtraction = {
    signaturePhrases: [],
    signatureOpenings: [],
    signatureClosings: [],
    toneKeywords: [],
    vocabularySignature: {},
    promptSnippet: "",
  };
  if (stats.totalWords >= VOICE_MIN_CORPUS_WORDS) {
    qualitative = await extractQualitative(samples, args.agencyOwnerId);
  }

  const now = new Date().toISOString();
  const upsertRow = {
    agency_owner_id: args.agencyOwnerId,
    subject_kind: args.subjectKind,
    subject_id: args.subjectId,
    corpus_size_words: stats.totalWords,
    formality_score: stats.formalityScore,
    avg_sentence_length: stats.avgSentenceLength,
    contraction_rate: stats.contractionRate,
    emoji_rate: stats.emojiRate,
    em_dash_rate: stats.emDashRate,
    exclamation_rate: stats.exclamationRate,
    signature_phrases: qualitative.signaturePhrases,
    signature_openings: qualitative.signatureOpenings,
    signature_closings: qualitative.signatureClosings,
    tone_keywords: qualitative.toneKeywords,
    vocabulary_signature: qualitative.vocabularySignature,
    prompt_snippet: qualitative.promptSnippet,
    computed_at: now,
    corpus_size_at_computation: stats.totalWords,
  };

  const { error: upsertErr } = await supabase
    .from("writing_voice_profiles")
    .upsert(upsertRow, { onConflict: "subject_kind,subject_id" });
  if (upsertErr) {
    console.warn("[voice-profile] upsert failed:", upsertErr.message);
    return { ok: false, reason: "upsert_failed" };
  }
  return { ok: true, corpusSizeWords: stats.totalWords };
}

// ─── Helpers exposed for tests ──────────────────────────────────────────
// Stats helpers are exported from `voice-profile-stats.ts` directly so test
// files don't pull in the LLM router and Anthropic SDK init.
