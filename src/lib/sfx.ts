// Soothing SFX — Smooth, calming sounds like water drops and soft chimes
// Uses Web Audio API with reverb-like effects

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Create a simple reverb effect
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createReverb(ctx: AudioContext, duration: number = 0.3): ConvolverNode {
  const conv = ctx.createConvolver();
  const len = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
  }
  conv.buffer = buf;
  return conv;
}

// Micro tick — ultra-subtle single pulse, barely audible click confirmation
export function sfxClick() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(800, ctx.currentTime);
    o.type = "sine";
    g.gain.setValueAtTime(0.008, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
    o.start(); o.stop(ctx.currentTime + 0.015);
  } catch {}
}

// Soft tick — slightly warmer micro tick for toggles, selections
export function sfxPop() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(600, ctx.currentTime);
    o.type = "triangle";
    g.gain.setValueAtTime(0.010, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02);
    o.start(); o.stop(ctx.currentTime + 0.02);
  } catch {}
}

// Subtle ascending pair for success
export function sfxSuccess() {
  try {
    const ctx = getCtx();
    [523, 659].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      o.type = "sine";
      g.gain.setValueAtTime(0.008, ctx.currentTime + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.08 + 0.12);
      o.start(ctx.currentTime + i * 0.08);
      o.stop(ctx.currentTime + i * 0.08 + 0.12);
    });
  } catch {}
}

// Subtle low dip for errors
export function sfxError() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.06);
    o.type = "sine";
    g.gain.setValueAtTime(0.010, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    o.start(); o.stop(ctx.currentTime + 0.08);
  } catch {}
}

// Micro whoosh — barely-there filtered noise for page transitions
export function sfxWhoosh() {
  try {
    const ctx = getCtx();
    const bufSize = ctx.sampleRate * 0.03;
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
    f.frequency.value = 2000;
    f.Q.value = 0.5;
    g.gain.setValueAtTime(0.005, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
    src.start(); src.stop(ctx.currentTime + 0.03);
  } catch {}
}

// Single soft ping — for notifications
export function sfxNotification() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.type = "sine";
    g.gain.setValueAtTime(0.010, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.10);
    o.start(); o.stop(ctx.currentTime + 0.10);
  } catch {}
}

// Rising pair — mic on
export function sfxMicOn() {
  try {
    const ctx = getCtx();
    [400, 600].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
      o.type = "sine";
      g.gain.setValueAtTime(0.008, ctx.currentTime + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.06 + 0.08);
      o.start(ctx.currentTime + i * 0.06);
      o.stop(ctx.currentTime + i * 0.06 + 0.08);
    });
  } catch {}
}

// Falling pair — mic off
export function sfxMicOff() {
  try {
    const ctx = getCtx();
    [600, 400].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.06);
      o.type = "sine";
      g.gain.setValueAtTime(0.008, ctx.currentTime + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.06 + 0.08);
      o.start(ctx.currentTime + i * 0.06);
      o.stop(ctx.currentTime + i * 0.06 + 0.08);
    });
  } catch {}
}

// Hover — disabled (no sound on hover, too annoying)
export function sfxHover() {
  // Intentionally silent — hover sounds are distracting
}
