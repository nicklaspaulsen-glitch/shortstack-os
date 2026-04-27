/**
 * Pure stats helpers for the writing-voice profile.
 *
 * Kept in a separate file from `voice-profile.ts` so consumers (and
 * tests) can import the math without dragging in the LLM router and the
 * Anthropic SDK module init. No I/O, no SDK calls — safe to use in
 * browser-like / jsdom test environments.
 */

export interface DeterministicStats {
  totalWords: number;
  avgSentenceLength: number;
  contractionRate: number;
  emojiRate: number;
  emDashRate: number;
  exclamationRate: number;
  formalityScore: number;
}

const CONTRACTION_RE = /\b\w+'(?:s|t|re|ll|ve|d|m)\b/gi;
// Use surrogate-pair ranges directly so we don't depend on the `u` flag,
// which only landed in ES6+. Covers the common emoji blocks.
const EMOJI_RE =
  /\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF]|[☀-➿]/g;

const FORMAL_MARKERS = [
  "regards", "sincerely", "kindly", "shall", "hereby", "furthermore",
  "therefore", "accordingly", "pursuant",
];
const CASUAL_MARKERS = [
  "hey", "yo", "lol", "btw", "tbh", "kinda", "gonna", "wanna", "imo",
  "nope", "yeah", "lemme",
];

export const VOICE_MIN_CORPUS_WORDS = 200;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function computeStats(samples: string[]): DeterministicStats {
  const joined = samples.join("\n\n");
  const totalWords = countWords(joined);
  if (totalWords === 0) {
    return {
      totalWords: 0,
      avgSentenceLength: 0,
      contractionRate: 0,
      emojiRate: 0,
      emDashRate: 0,
      exclamationRate: 0,
      formalityScore: 0.5,
    };
  }

  const sentences = joined
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length === 0
    ? totalWords
    : Math.round((totalWords / sentences.length) * 100) / 100;

  const contractions = (joined.match(CONTRACTION_RE) || []).length;
  // Crude denominator: total apostrophe-bearing word slots ~= contractions
  // plus the formal "do not" / "will not" / "are not" forms.
  const formalNots = (joined.match(/\b(do|did|does|will|are|is|was|were|has|have|had|cannot|can|could|should|would) not\b/gi) || []).length;
  const contractionRate = contractions + formalNots === 0
    ? 0
    : Math.round((contractions / (contractions + formalNots)) * 100) / 100;

  const emojiCount = (joined.match(EMOJI_RE) || []).length;
  const emojiRate = Math.round((emojiCount / Math.max(totalWords, 1)) * 100 * 100) / 100;

  const emDashCount = (joined.match(/—/g) || []).length;
  const emDashRate = Math.round((emDashCount / Math.max(totalWords, 1)) * 100 * 100) / 100;

  const exclamationCount = (joined.match(/!/g) || []).length;
  const exclamationRate = Math.round((exclamationCount / Math.max(totalWords, 1)) * 100 * 100) / 100;

  const lower = joined.toLowerCase();
  let formalHits = 0;
  let casualHits = 0;
  for (const w of FORMAL_MARKERS) if (lower.includes(w)) formalHits += 1;
  for (const w of CASUAL_MARKERS) if (lower.includes(w)) casualHits += 1;
  const totalHits = formalHits + casualHits;
  const formalityScore =
    totalHits === 0
      ? 0.5
      : Math.round((formalHits / totalHits) * 100) / 100;

  return {
    totalWords,
    avgSentenceLength,
    contractionRate,
    emojiRate,
    emDashRate,
    exclamationRate,
    formalityScore,
  };
}
