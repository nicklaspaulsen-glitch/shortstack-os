// Soothing SFX — Smooth, calming sounds like water drops and soft chimes
// Uses Web Audio API with reverb-like effects

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Create a simple reverb effect
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

// Water drop — for clicks, nav
export function sfxClick() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const reverb = createReverb(ctx, 0.2);
    o.connect(g); g.connect(reverb); reverb.connect(ctx.destination);
    g.connect(ctx.destination); // dry mix
    o.frequency.setValueAtTime(1200, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.06);
    o.type = "sine";
    g.gain.setValueAtTime(0.015, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.start(); o.stop(ctx.currentTime + 0.1);
  } catch {}
}

// Soft chime — for toggles, selections
export function sfxPop() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(900, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
    o.type = "sine";
    g.gain.setValueAtTime(0.018, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    o.start(); o.stop(ctx.currentTime + 0.2);
  } catch {}
}

// Wind chime — gentle ascending notes for success
export function sfxSuccess() {
  try {
    const ctx = getCtx();
    const reverb = createReverb(ctx, 0.5);
    reverb.connect(ctx.destination);
    [392, 523, 659].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(reverb); g.connect(ctx.destination);
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      o.type = "sine";
      g.gain.setValueAtTime(0.015, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.35);
    });
  } catch {}
}

// Deep hum — soft low tone for errors
export function sfxError() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.2);
    o.type = "sine";
    g.gain.setValueAtTime(0.015, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch {}
}

// Soft air — for page transitions
export function sfxWhoosh() {
  try {
    const ctx = getCtx();
    const bufSize = ctx.sampleRate * 0.1;
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
    f.type = "bandpass";
    f.frequency.setValueAtTime(1500, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    f.Q.value = 0.5;
    g.gain.setValueAtTime(0.01, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    src.start(); src.stop(ctx.currentTime + 0.1);
  } catch {}
}

// Single bell — for notifications
export function sfxNotification() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const reverb = createReverb(ctx, 0.4);
    o.connect(g); g.connect(reverb); reverb.connect(ctx.destination);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.type = "sine";
    g.gain.setValueAtTime(0.02, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch {}
}

// Rising tone — mic on
export function sfxMicOn() {
  try {
    const ctx = getCtx();
    [350, 500, 650].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      o.type = "sine";
      g.gain.setValueAtTime(0.012, ctx.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
      o.start(ctx.currentTime + i * 0.1);
      o.stop(ctx.currentTime + i * 0.1 + 0.2);
    });
  } catch {}
}

// Falling tone — mic off
export function sfxMicOff() {
  try {
    const ctx = getCtx();
    [650, 500, 350].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
      o.type = "sine";
      g.gain.setValueAtTime(0.012, ctx.currentTime + i * 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2);
      o.start(ctx.currentTime + i * 0.1);
      o.stop(ctx.currentTime + i * 0.1 + 0.2);
    });
  } catch {}
}

// Almost silent — hover
export function sfxHover() {
  try {
    const ctx = getCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(700, ctx.currentTime);
    o.type = "sine";
    g.gain.setValueAtTime(0.004, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
    o.start(); o.stop(ctx.currentTime + 0.02);
  } catch {}
}
