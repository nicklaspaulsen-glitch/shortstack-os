/**
 * Deterministic call-metrics computation for the AI Sales Coach.
 *
 * These numbers must be reproducible and cheap — they don't go through the LLM.
 * The router (`callLLM`) is reserved for the qualitative insights layer that
 * sits on top of these primitives.
 *
 * Two transcript shapes are supported:
 *   1. Plain text — speaker turns marked with prefixes like `Rep:` or
 *      `Speaker 1:` / `Prospect:` / etc., one turn per line.
 *   2. Diarized segments — `Array<{ start, end, speaker, text }>` (matches the
 *      `meetings.transcript_speaker_labeled` jsonb shape).
 *
 * If neither shape is detectable, we fall back to single-speaker assumptions
 * (rep-only) so the function never throws on bad input.
 */

export interface TranscriptSegment {
  start: number;
  end: number;
  speaker?: string;
  text: string;
}

export interface CallMetrics {
  /** 0..1 — fraction of total spoken words attributed to the rep. */
  talk_ratio: number;
  /** Mean words-per-minute spoken by the rep across the call. */
  words_per_minute: number;
  /** Count of filler tokens ("um", "uh", "like", "so", "you know"). */
  filler_words_count: number;
  /** Longest contiguous rep-only stretch in seconds. */
  longest_monologue_secs: number;
  /** Total rep words. */
  rep_word_count: number;
  /** Total prospect words. */
  prospect_word_count: number;
  /** Number of distinct rep turns. */
  rep_turn_count: number;
  /** Number of distinct prospect turns. */
  prospect_turn_count: number;
  /** Total call duration in seconds (echoes the input — useful in payload). */
  duration_seconds: number;
}

/**
 * Filler tokens we count. Multi-word fillers must be matched as a phrase before
 * single-word tokens to avoid double counting.
 */
const FILLER_PHRASES = ["you know", "i mean", "kind of", "sort of"] as const;
const FILLER_WORDS = ["um", "uh", "uhh", "umm", "like", "so", "basically", "literally", "actually"] as const;

const REP_SPEAKER_PATTERN = /^(rep|agent|sales|advisor|me|speaker[\s_]*1|s1|host)$/i;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countFillers(text: string): number {
  const lower = ` ${text.toLowerCase()} `;
  let total = 0;
  let stripped = lower;

  for (const phrase of FILLER_PHRASES) {
    const re = new RegExp(`\\b${phrase}\\b`, "g");
    const matches = stripped.match(re);
    if (matches) {
      total += matches.length;
      stripped = stripped.replace(re, " ");
    }
  }

  for (const word of FILLER_WORDS) {
    const re = new RegExp(`\\b${word}\\b`, "g");
    const matches = stripped.match(re);
    if (matches) total += matches.length;
  }

  return total;
}

interface ParsedTurn {
  speaker: string;
  isRep: boolean;
  text: string;
  start?: number;
  end?: number;
  wordCount: number;
}

function classifySpeaker(label: string | undefined, isFirst: boolean): boolean {
  if (!label) return isFirst; // unknown — assume the first speaker is the rep
  if (REP_SPEAKER_PATTERN.test(label.trim())) return true;
  // "Speaker 1" defaults to rep, "Speaker 2" defaults to prospect.
  if (/^speaker[\s_]*2$/i.test(label.trim())) return false;
  if (/^prospect|customer|client|lead|caller$/i.test(label.trim())) return false;
  return false;
}

function parseSegments(segments: TranscriptSegment[]): ParsedTurn[] {
  if (segments.length === 0) return [];
  // Pick a representative "rep speaker" by majority duration of speaker[0]'s
  // label vs others — for diarized output, we trust the speaker labels.
  return segments.map((s, idx) => {
    const isRep = classifySpeaker(s.speaker, idx === 0);
    return {
      speaker: s.speaker || (idx === 0 ? "rep" : "prospect"),
      isRep,
      text: s.text || "",
      start: s.start,
      end: s.end,
      wordCount: tokenize(s.text || "").length,
    };
  });
}

/**
 * Parse a plain-text transcript with `Speaker:` line prefixes. Lines without a
 * recognised speaker prefix are appended to the previous turn.
 */
function parsePlainText(transcript: string): ParsedTurn[] {
  const lines = transcript.split(/\r?\n/);
  const turns: ParsedTurn[] = [];
  let currentSpeaker: string | undefined;
  let currentBuffer: string[] = [];

  const flush = () => {
    if (currentBuffer.length === 0) return;
    const text = currentBuffer.join(" ").trim();
    if (!text) {
      currentBuffer = [];
      return;
    }
    const isRep = classifySpeaker(currentSpeaker, turns.length === 0);
    turns.push({
      speaker: currentSpeaker || (turns.length === 0 ? "rep" : "prospect"),
      isRep,
      text,
      wordCount: tokenize(text).length,
    });
    currentBuffer = [];
  };

  const speakerLine = /^\s*([A-Za-z][A-Za-z0-9 _-]{0,30}?)\s*:\s*(.*)$/;

  for (const raw of lines) {
    const m = raw.match(speakerLine);
    if (m) {
      flush();
      currentSpeaker = m[1];
      if (m[2]) currentBuffer.push(m[2]);
    } else {
      currentBuffer.push(raw);
    }
  }
  flush();

  // If we never saw a speaker prefix, treat the whole transcript as one rep
  // monologue (so metrics stay stable on free-form input).
  if (turns.length === 0 && transcript.trim()) {
    turns.push({
      speaker: "rep",
      isRep: true,
      text: transcript,
      wordCount: tokenize(transcript).length,
    });
  }

  return turns;
}

/**
 * Estimate per-turn timestamps when only plain text is available, by spreading
 * the total duration proportionally across word counts. Used for monologue
 * detection.
 */
function estimateTimestamps(turns: ParsedTurn[], totalSeconds: number): ParsedTurn[] {
  const totalWords = turns.reduce((sum, t) => sum + t.wordCount, 0) || 1;
  const secondsPerWord = totalSeconds / totalWords;
  let cursor = 0;
  return turns.map((t) => {
    const start = cursor;
    const end = cursor + t.wordCount * secondsPerWord;
    cursor = end;
    return {
      ...t,
      start: t.start ?? start,
      end: t.end ?? end,
    };
  });
}

/**
 * Compute deterministic call metrics from a transcript and total duration.
 *
 * - Rep talk_ratio is computed by word count (more stable than time when
 *   diarisation is missing).
 * - WPM is rep words / rep speaking minutes. We use total duration as an
 *   upper bound when diarisation is missing, so plain text still yields a
 *   sane number.
 * - Longest monologue is the longest contiguous run of rep turns by elapsed
 *   wall-clock time.
 */
export function computeCallMetrics(
  transcript: string,
  durationSeconds: number,
  segments?: TranscriptSegment[],
): CallMetrics {
  const safeDuration = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : 0;

  const rawTurns = segments && segments.length > 0
    ? parseSegments(segments)
    : parsePlainText(transcript || "");
  const turns = estimateTimestamps(rawTurns, safeDuration || 60);

  let repWords = 0;
  let prospectWords = 0;
  let repTurnCount = 0;
  let prospectTurnCount = 0;
  let fillerCount = 0;

  // Longest contiguous rep-only stretch (in seconds).
  let longestMonologue = 0;
  let currentMonologueStart: number | null = null;
  let currentMonologueEnd: number | null = null;

  for (const turn of turns) {
    if (turn.isRep) {
      repWords += turn.wordCount;
      repTurnCount += 1;
      fillerCount += countFillers(turn.text);
      if (currentMonologueStart === null && turn.start !== undefined) {
        currentMonologueStart = turn.start;
      }
      if (turn.end !== undefined) currentMonologueEnd = turn.end;
    } else {
      prospectWords += turn.wordCount;
      prospectTurnCount += 1;
      if (currentMonologueStart !== null && currentMonologueEnd !== null) {
        const span = Math.max(0, currentMonologueEnd - currentMonologueStart);
        if (span > longestMonologue) longestMonologue = span;
      }
      currentMonologueStart = null;
      currentMonologueEnd = null;
    }
  }
  // Tail: trailing rep monologue.
  if (currentMonologueStart !== null && currentMonologueEnd !== null) {
    const span = Math.max(0, currentMonologueEnd - currentMonologueStart);
    if (span > longestMonologue) longestMonologue = span;
  }

  const totalWords = repWords + prospectWords;
  const talkRatio = totalWords > 0 ? repWords / totalWords : 1;

  // WPM: rep words / rep speaking minutes. When we don't have rep-only timing,
  // fall back to the total duration as an upper bound.
  let repSpeakingSeconds = 0;
  for (const turn of turns) {
    if (turn.isRep && turn.start !== undefined && turn.end !== undefined) {
      repSpeakingSeconds += Math.max(0, turn.end - turn.start);
    }
  }
  const wpmDenominatorMinutes = repSpeakingSeconds > 0
    ? repSpeakingSeconds / 60
    : safeDuration > 0
      ? safeDuration / 60
      : 1;
  const wpm = wpmDenominatorMinutes > 0 ? repWords / wpmDenominatorMinutes : 0;

  return {
    talk_ratio: Math.round(talkRatio * 1000) / 1000,
    words_per_minute: Math.round(wpm),
    filler_words_count: fillerCount,
    longest_monologue_secs: Math.round(longestMonologue),
    rep_word_count: repWords,
    prospect_word_count: prospectWords,
    rep_turn_count: repTurnCount,
    prospect_turn_count: prospectTurnCount,
    duration_seconds: Math.round(safeDuration),
  };
}

/**
 * Translate a metrics bundle into a 0..100 deterministic score. The LLM layer
 * adjusts this based on qualitative findings, but the score is anchored here
 * so empty / token-budget-limited responses still ship a sane number.
 *
 * Anchors (loosely calibrated against published sales-coaching benchmarks):
 *   - Ideal rep talk ratio: 0.40 (range 0.30..0.55 → full credit)
 *   - Ideal WPM: 140 (range 110..170)
 *   - Filler density penalty kicks in above 8 fillers / 100 words
 *   - Longest monologue penalty kicks in above 90s
 */
export function scoreMetrics(metrics: CallMetrics): number {
  let score = 100;

  // Talk ratio component — 40% weight.
  const ratio = metrics.talk_ratio;
  if (ratio < 0.30 || ratio > 0.55) {
    const deviation = Math.min(1, Math.abs(ratio - 0.42) / 0.42);
    score -= Math.round(deviation * 40);
  }

  // WPM component — 20% weight.
  const wpm = metrics.words_per_minute;
  if (wpm > 0 && (wpm < 110 || wpm > 180)) {
    const deviation = Math.min(1, Math.abs(wpm - 140) / 140);
    score -= Math.round(deviation * 20);
  }

  // Filler density — 20% weight.
  const totalWords = metrics.rep_word_count;
  if (totalWords > 0) {
    const density = metrics.filler_words_count / totalWords;
    // 0..2% fillers = clean, 2..6% noticeable, >6% bad.
    if (density > 0.02) {
      const excess = Math.min(0.10, density - 0.02);
      score -= Math.round((excess / 0.08) * 20);
    }
  }

  // Longest monologue — 20% weight.
  const monologue = metrics.longest_monologue_secs;
  if (monologue > 90) {
    const excess = Math.min(180, monologue - 90);
    score -= Math.round((excess / 180) * 20);
  }

  return Math.max(0, Math.min(100, score));
}
