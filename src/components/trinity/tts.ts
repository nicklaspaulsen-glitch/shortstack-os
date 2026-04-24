/**
 * Trinity TTS engine — extracted from trinity-orb.tsx so the provider
 * cascade (XTTS → OpenAI → ElevenLabs → browser fallback), the sentence
 * splitter, and the emoji/markdown sanitiser only land in the bundle
 * when Trinity is actually asked to speak.
 *
 * The orb shell imports this module dynamically on first speak().
 */

let audioEl: HTMLAudioElement | null = null;
let speakVersion = 0;

export function stopAllAudio() {
  if (typeof window === "undefined") return;
  speakVersion++;
  if (audioEl) {
    audioEl.pause();
    audioEl.src = "";
    audioEl = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function speakViaBrowser(text: string, onStart: () => void, onEnd: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);

  const voices = window.speechSynthesis.getVoices();

  const blocklist = /David|Mark|Zira Desktop|Zira - English|Microsoft Desktop|James|Richard|George|Hazel/i;
  const pickers: Array<(v: SpeechSynthesisVoice) => boolean> = [
    (v) => /Aria.*Online.*Natural|Jenny.*Online.*Natural|Guy.*Online.*Natural/i.test(v.name),
    (v) => /Natural|Neural/i.test(v.name) && v.lang.startsWith("en") && !blocklist.test(v.name),
    (v) => /Samantha|Serena|Ava|Allison/.test(v.name),
    (v) => /Google.*US English|Google.*UK English.*Female/i.test(v.name),
    (v) => v.name.startsWith("Google") && v.lang.startsWith("en"),
    (v) => v.lang === "en-US" && !blocklist.test(v.name),
    (v) => v.lang.startsWith("en") && !blocklist.test(v.name),
    (v) => v.lang.startsWith("en"),
  ];
  let pickedName: string | null = null;
  for (const pick of pickers) {
    const found = voices.find(pick);
    if (found) {
      utter.voice = found;
      pickedName = found.name;
      break;
    }
  }

  console.log(`[trinity/tts] browser fallback voice: ${pickedName || "(default)"}`);

  utter.rate = 1.0;
  utter.pitch = 1.0;
  utter.volume = 1.0;
  utter.onstart = onStart;
  utter.onend = onEnd;
  utter.onerror = onEnd;
  window.speechSynthesis.speak(utter);
}

const EMOJI_RE = new RegExp(
  "[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]" +
    "|" +
    "[\\u2600-\\u27BF\\uFE0F\\u200D]",
  "g",
);

function sanitizeForSpeech(text: string): string {
  return text
    .replace(EMOJI_RE, "")
    .replace(/\*\*|__|`{1,3}|~~/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  const raw: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    current += c;
    const next = text[i + 1];
    if ((c === "." || c === "!" || c === "?" || c === "\n") &&
        (!next || next === " " || next === "\n")) {
      if (current.trim()) raw.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) raw.push(current.trim());

  const merged: string[] = [];
  let buf = "";
  for (const s of raw) {
    buf = buf ? `${buf} ${s}` : s;
    if (buf.length >= 30) {
      merged.push(buf);
      buf = "";
    }
  }
  if (buf) {
    if (merged.length > 0) merged[merged.length - 1] += ` ${buf}`;
    else merged.push(buf);
  }
  return merged;
}

async function fetchTtsBlob(sentence: string): Promise<{ blob: Blob; provider: string } | null> {
  try {
    const res = await fetch("/api/tts/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sentence }),
    });
    if (!res.ok) {
      const debug = await res.json().catch(() => ({}));
      console.error(`[trinity/tts] ${res.status}`, debug);
      return null;
    }
    const provider = res.headers.get("x-tts-provider") || "unknown";
    const blob = await res.blob();
    return { blob, provider };
  } catch (err) {
    console.error("[trinity/tts] fetch error:", err);
    return null;
  }
}

function playBlob(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1.0;
    audioEl = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (audioEl === audio) audioEl = null;
      resolve();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      if (audioEl === audio) audioEl = null;
      resolve();
    };
    audio.play().catch(() => resolve());
  });
}

/**
 * Speak `text` out loud via the server TTS cascade. `isMuted` is a
 * getter so the caller can bail the stream mid-flight when the user
 * toggles mute. `onSpeakingChange` mirrors what the old in-file state
 * did so the shell can style the orb + mute button.
 */
export async function speak(
  text: string,
  opts: {
    isMuted: () => boolean;
    onSpeakingChange: (speaking: boolean) => void;
  },
) {
  const { isMuted, onSpeakingChange } = opts;
  if (isMuted() || !text) return;
  if (typeof window === "undefined") return;

  const cleaned = sanitizeForSpeech(text);
  if (!cleaned) return;

  stopAllAudio();
  const myVersion = ++speakVersion;

  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) return;

  const blobPromises = sentences.map((s) => fetchTtsBlob(s));

  onSpeakingChange(true);
  let playedAny = false;
  for (let i = 0; i < blobPromises.length; i++) {
    if (myVersion !== speakVersion || isMuted()) {
      onSpeakingChange(false);
      return;
    }
    const result = await blobPromises[i];
    if (myVersion !== speakVersion || isMuted()) {
      onSpeakingChange(false);
      return;
    }
    if (!result) {
      if (!playedAny) {
        speakViaBrowser(
          sentences.slice(i).join(" "),
          () => onSpeakingChange(true),
          () => onSpeakingChange(false),
        );
        return;
      }
      continue;
    }
    if (i === 0) {
      console.log(
        `[trinity/tts] ✓ streaming via ${result.provider} — ${sentences.length} sentence${sentences.length === 1 ? "" : "s"}`,
      );
    }
    playedAny = true;
    await playBlob(result.blob);
  }
  onSpeakingChange(false);
}
