"use client";

import { useState } from "react";

// ── Sound option definitions ────────────────────────────────────────
const SOUND_OPTIONS = [
  {
    id: "off",
    name: "Off",
    desc: "No click sounds. Pure visual feedback only.",
    play: () => {},
  },
  {
    id: "micro_tick",
    name: "Micro Tick",
    desc: "Ultra-minimal single pulse. Barely audible — just enough to confirm your click registered.",
    play: () => {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(800, ctx.currentTime);
      o.type = "sine";
      g.gain.setValueAtTime(0.008, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
      o.start(); o.stop(ctx.currentTime + 0.015);
    },
  },
  {
    id: "soft_tap",
    name: "Soft Tap",
    desc: "Gentle tap — like tapping a glass surface. Short triangle wave, very quiet.",
    play: () => {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(440, ctx.currentTime);
      o.type = "triangle";
      g.gain.setValueAtTime(0.012, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.025);
      o.start(); o.stop(ctx.currentTime + 0.025);
    },
  },
  {
    id: "whisper_click",
    name: "Whisper Click",
    desc: "Filtered noise burst — sounds like a soft mechanical key press. Zero tonality.",
    play: () => {
      const ctx = new AudioContext();
      const bufSize = ctx.sampleRate * 0.012;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        const env = Math.sin((i / bufSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      src.buffer = buf;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      f.type = "highpass";
      f.frequency.value = 3000;
      f.Q.value = 0.7;
      g.gain.setValueAtTime(0.008, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.012);
      src.start(); src.stop(ctx.currentTime + 0.012);
    },
  },
  {
    id: "gentle_bubble",
    name: "Gentle Bubble",
    desc: "Tiny frequency dip — a softer version of the current water drop, 80% quieter and shorter.",
    play: () => {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(600, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.04);
      o.type = "sine";
      g.gain.setValueAtTime(0.006, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
      o.start(); o.stop(ctx.currentTime + 0.05);
    },
  },
  {
    id: "haptic",
    name: "Haptic Pulse",
    desc: "Low-frequency thump you feel more than hear. Like phone haptics translated to audio.",
    play: () => {
      const ctx = new AudioContext();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(80, ctx.currentTime);
      o.type = "sine";
      g.gain.setValueAtTime(0.025, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      o.start(); o.stop(ctx.currentTime + 0.03);
    },
  },
];

export default function SoundPreviewPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [lastPlayed, setLastPlayed] = useState<string | null>(null);

  const playSound = (id: string) => {
    const opt = SOUND_OPTIONS.find(o => o.id === id);
    if (opt) {
      opt.play();
      setLastPlayed(id);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b0d12" }}>
      <div className="max-w-2xl w-full mx-auto p-8">
        <h1 className="text-3xl font-extrabold text-white mb-2" style={{ letterSpacing: "-0.03em" }}>
          Pick a Click Sound
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          Click each option to hear it. The selected sound will play on every button/link click across the dashboard.
        </p>

        <div className="space-y-3">
          {SOUND_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={(e) => {
                e.stopPropagation();
                playSound(opt.id);
                setSelected(opt.id);
              }}
              className={`w-full text-left rounded-xl p-4 transition-all border ${
                selected === opt.id
                  ? "border-amber-500/40 bg-amber-500/[0.06]"
                  : lastPlayed === opt.id
                  ? "border-white/10 bg-white/[0.04]"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selected === opt.id ? "border-amber-500" : "border-gray-600"
                    }`}>
                      {selected === opt.id && (
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <span className="text-white font-semibold text-sm">{opt.name}</span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1 ml-7">{opt.desc}</p>
                </div>
                <span className="text-gray-600 text-xs shrink-0 ml-4">Click to hear</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-xs">
            {selected ? `Selected: ${SOUND_OPTIONS.find(o => o.id === selected)?.name}` : "Click an option to preview & select"}
          </p>
        </div>
      </div>
    </div>
  );
}
