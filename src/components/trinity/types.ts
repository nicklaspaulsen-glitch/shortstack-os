/**
 * Shared types for Trinity orb sub-components. Extracted so each lazy
 * chunk can import the same shape without re-declaring.
 */

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>;
}

// Web Speech API types — browsers expose it unprefixed or as webkitSpeechRecognition.
// We declare the bits we use so TS is happy without pulling in @types/dom-speech-recognition.
export interface SpeechRecognitionResultLite {
  0: { transcript: string };
  isFinal: boolean;
}
export interface SpeechRecognitionEventLite extends Event {
  results: { [i: number]: SpeechRecognitionResultLite; length: number };
}
export interface SpeechRecognitionLite {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLite) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
export type SpeechCtor = new () => SpeechRecognitionLite;
