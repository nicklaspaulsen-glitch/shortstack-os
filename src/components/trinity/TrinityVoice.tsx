"use client";

/**
 * TrinityVoice — the microphone button that uses the Web Speech API to
 * dictate into Trinity's prompt. Kept in its own lazy chunk because the
 * Web Speech plumbing + refs aren't needed for readers who only ever
 * type.
 */

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import type { SpeechCtor, SpeechRecognitionLite } from "./types";

interface Props {
  listening: boolean;
  onListeningChange: (listening: boolean) => void;
  onTranscript: (text: string) => void;
}

export default function TrinityVoice({ listening, onListeningChange, onTranscript }: Props) {
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLite | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (Ctor) setMicSupported(true);
  }, []);

  function toggleMic() {
    if (!micSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      onListeningChange(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const recog = new Ctor();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = "en-US";
    recog.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      onTranscript(transcript);
    };
    recog.onerror = () => onListeningChange(false);
    recog.onend = () => onListeningChange(false);
    recognitionRef.current = recog;
    recog.start();
    onListeningChange(true);
  }

  if (!micSupported) return null;

  return (
    <button
      type="button"
      onClick={toggleMic}
      title={listening ? "Stop listening" : "Speak to Trinity"}
      className={`absolute right-2 bottom-2 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
        listening
          ? "bg-danger/15 text-danger animate-pulse"
          : "bg-surface-light text-muted hover:text-gold hover:bg-gold/10"
      }`}
    >
      {listening ? <MicOff size={14} /> : <Mic size={14} />}
    </button>
  );
}

// Imperative stopper exposed for parents that send messages — imported
// lazily by the orb when it needs to cancel an active mic session.
export function stopActiveRecognition(ref: React.MutableRefObject<SpeechRecognitionLite | null>) {
  ref.current?.stop();
}
