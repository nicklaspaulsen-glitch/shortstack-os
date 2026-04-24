"use client";

/**
 * TrinitySettings — the TTS mute + stop-speaking controls docked in the
 * top-right of the orb card. Kept in its own lazy chunk because on
 * browsers that don't support audio/SpeechSynthesis we don't render
 * anything, and the icons pull in a couple more lucide glyphs than the
 * shell needs.
 */

import { Volume2, VolumeX, Square } from "lucide-react";

interface Props {
  ttsSupported: boolean;
  muted: boolean;
  speaking: boolean;
  onToggleMute: () => void;
  onStop: () => void;
}

export default function TrinitySettings({ ttsSupported, muted, speaking, onToggleMute, onStop }: Props) {
  if (!ttsSupported) return null;
  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
      {speaking && !muted && (
        <button
          type="button"
          onClick={onStop}
          title="Stop speaking"
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-danger/15 text-danger hover:bg-danger/25 transition-all"
        >
          <Square size={12} fill="currentColor" />
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMute}
        title={muted ? "Unmute Trinity's voice" : "Mute Trinity's voice"}
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
          muted
            ? "bg-surface-light text-muted hover:text-gold"
            : speaking
            ? "bg-gold/15 text-gold animate-pulse"
            : "bg-surface-light text-gold hover:bg-gold/10"
        }`}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
