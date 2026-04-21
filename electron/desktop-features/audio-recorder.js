// ShortStack OS — Voice Memo Recorder
//
// Desktop-only differentiator: system-wide voice capture that works even
// when ShortStack is in the tray. Uses navigator.mediaDevices.getUserMedia
// in a hidden renderer (MediaRecorder is a renderer-side API) and pipes
// the resulting blob to disk.
//
// Hotkey: Ctrl+Shift+V toggles recording. While recording, the tray
// tooltip pulses to hint that capture is live.
//
// Output: <userData>/voice-memos/<timestamp>.webm (opus container).
// We prefer .webm/opus because it's natively supported by the Chromium
// renderer's MediaRecorder. MP3 would require an extra encoding pass via
// ffmpeg — we skip that to keep the module dep-free and fall back to .webm.
//
// On stop we optimistically POST the audio to /api/transcribe via the
// stored agent session. If that endpoint doesn't exist yet, we log the
// 404 silently and still surface the filepath so the renderer can attach
// it to the current client's notes via the existing notes IPC.

const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  net,
} = require("electron");
const path = require("path");
const fs = require("fs");

let ctx = null;
let recorderWindow = null;
let isRecording = false;
let currentOutputPath = null;
let pendingStopResolver = null;
let trayPulseInterval = null;

const HOTKEY = "CommandOrControl+Shift+V";

function memosDir() {
  const dir = path.join(app.getPath("userData"), "voice-memos");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function startTrayPulse() {
  const tray = ctx?.trayEnhancer?.getTray?.()
    || ctx?.getTray?.()
    || null;
  if (!tray || tray.isDestroyed?.()) return;

  let toggled = false;
  stopTrayPulse(); // guard against dupes
  trayPulseInterval = setInterval(() => {
    toggled = !toggled;
    try {
      tray.setToolTip(toggled
        ? "ShortStack OS — Recording voice memo..."
        : "ShortStack OS — Recording"
      );
    } catch {}
  }, 600);
}

function stopTrayPulse() {
  if (trayPulseInterval) {
    clearInterval(trayPulseInterval);
    trayPulseInterval = null;
  }
  const tray = ctx?.trayEnhancer?.getTray?.()
    || ctx?.getTray?.()
    || null;
  if (tray && !tray.isDestroyed?.()) {
    try { tray.setToolTip("ShortStack OS"); } catch {}
  }
}

function createRecorderWindow(outputPath) {
  const win = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body>
    <script>
      const { ipcRenderer } = require('electron');
      const fs = require('fs');
      const OUTPUT_PATH = ${JSON.stringify(outputPath)};

      let mediaRecorder = null;
      let chunks = [];
      let stream = null;

      async function start() {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

          // Prefer opus in webm — universally supported by the Chromium
          // renderer. Fall back gracefully; if nothing works we still let
          // the browser pick a default and the filename extension stays
          // .webm which is Chromium's default container.
          const preferred = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
          ];
          let mimeType = '';
          for (const m of preferred) {
            if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
          }

          mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
          chunks = [];
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          mediaRecorder.onstop = async () => {
            try {
              const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
              const buf = Buffer.from(await blob.arrayBuffer());
              fs.writeFileSync(OUTPUT_PATH, buf);
              ipcRenderer.send('audioRecorder:saved', {
                path: OUTPUT_PATH,
                size: buf.length,
                mimeType: mediaRecorder.mimeType || 'audio/webm',
              });
            } catch (err) {
              ipcRenderer.send('audioRecorder:error', { error: String(err && err.message || err) });
            } finally {
              if (stream) stream.getTracks().forEach(t => t.stop());
              stream = null;
            }
          };
          mediaRecorder.onerror = (e) => {
            ipcRenderer.send('audioRecorder:error', { error: String(e && e.error && e.error.message || 'recorder-error') });
          };
          mediaRecorder.start(1000);
          ipcRenderer.send('audioRecorder:started', { mimeType: mediaRecorder.mimeType });
        } catch (err) {
          ipcRenderer.send('audioRecorder:error', { error: String(err && err.message || err) });
        }
      }

      ipcRenderer.on('audioRecorder:stop', () => {
        try {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        } catch (err) {
          ipcRenderer.send('audioRecorder:error', { error: String(err && err.message || err) });
        }
      });

      start();
    </script>
  </body></html>`;

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return win;
}

async function start() {
  if (isRecording) {
    return { ok: false, error: "already-recording", path: currentOutputPath };
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  currentOutputPath = path.join(memosDir(), `${timestamp}.webm`);

  recorderWindow = createRecorderWindow(currentOutputPath);
  isRecording = true;
  startTrayPulse();

  ctx?.notify?.({
    title: "Voice memo recording",
    body: "Ctrl+Shift+V to stop.",
    silent: true,
  });

  return { ok: true, path: currentOutputPath };
}

function stop() {
  if (!isRecording || !recorderWindow || recorderWindow.isDestroyed()) {
    return Promise.resolve({ ok: false, error: "not-recording" });
  }

  return new Promise((resolve) => {
    pendingStopResolver = resolve;
    try {
      recorderWindow.webContents.send("audioRecorder:stop");
    } catch (err) {
      pendingStopResolver = null;
      resolve({ ok: false, error: String(err?.message || err) });
    }
    setTimeout(() => {
      if (pendingStopResolver === resolve) {
        pendingStopResolver = null;
        isRecording = false;
        stopTrayPulse();
        resolve({ ok: false, error: "stop-timeout", path: currentOutputPath });
      }
    }, 15000);
  });
}

async function toggle() {
  return isRecording ? stop() : start();
}

/**
 * Fire-and-forget attempt to transcribe the memo via the web API. If the
 * endpoint 404s or the user is offline we just skip — the filepath is
 * still returned to the renderer so the UI can attach the audio as a raw
 * note on the current client.
 */
async function tryTranscribe(filePath) {
  try {
    const appUrl = ctx?.appUrl;
    if (!appUrl) return { transcribed: false, reason: "no-app-url" };

    // Probe first — HEAD is lighter than POST and avoids uploading audio
    // to a non-existent endpoint.
    const probe = await net.fetch(appUrl + "/api/transcribe", { method: "HEAD" }).catch(() => null);
    if (!probe || probe.status === 404) {
      return { transcribed: false, reason: "endpoint-missing" };
    }

    const buf = fs.readFileSync(filePath);
    const form = new FormData();
    form.append(
      "file",
      new Blob([buf], { type: "audio/webm" }),
      path.basename(filePath)
    );

    const res = await net.fetch(appUrl + "/api/transcribe", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return { transcribed: false, reason: `status-${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { transcribed: true, text: data.text || data.transcript || "" };
  } catch (err) {
    return { transcribed: false, reason: String(err?.message || err) };
  }
}

function onSaved({ path: savedPath, size, mimeType }) {
  isRecording = false;
  stopTrayPulse();
  const wasResolver = pendingStopResolver;
  pendingStopResolver = null;

  try {
    if (recorderWindow && !recorderWindow.isDestroyed()) {
      recorderWindow.close();
    }
  } catch {}
  recorderWindow = null;

  // Notify renderer so the active client's notes panel can pick this up.
  try {
    const mw = ctx?.getMainWindow?.();
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send("desktop:voice-memo-saved", {
        path: savedPath,
        size,
        mimeType,
      });
    }
  } catch {}

  // Best-effort transcription — non-blocking UX. We still notify the user
  // the memo was saved immediately.
  tryTranscribe(savedPath).then((result) => {
    try {
      const mw = ctx?.getMainWindow?.();
      if (mw && !mw.isDestroyed()) {
        mw.webContents.send("desktop:voice-memo-transcribed", {
          path: savedPath,
          ...result,
        });
      }
    } catch {}
  }).catch(() => {});

  ctx?.notify?.({
    title: "Voice memo saved",
    body: `${path.basename(savedPath)} (${(size / 1024).toFixed(0)} KB). Attached to current client.`,
    silent: true,
    meta: { kind: "voice-memo-saved", path: savedPath, size },
  });

  if (wasResolver) {
    wasResolver({ ok: true, path: savedPath, size, mimeType });
  }
}

function onError({ error }) {
  isRecording = false;
  stopTrayPulse();
  const wasResolver = pendingStopResolver;
  pendingStopResolver = null;

  try {
    if (recorderWindow && !recorderWindow.isDestroyed()) {
      recorderWindow.close();
    }
  } catch {}
  recorderWindow = null;

  ctx?.notify?.({
    title: "Voice memo failed",
    body: String(error).slice(0, 200),
  });

  if (wasResolver) {
    wasResolver({ ok: false, error });
  }
}

/**
 * Public API matching the spec: returns a promise resolving with the
 * filepath once the user stops (via the same hotkey or a renderer call).
 * Resolves immediately with { alreadyRecording: true, path } if a
 * recording is already in progress.
 */
function recordVoiceMemo() {
  if (isRecording) {
    return Promise.resolve({
      ok: false,
      alreadyRecording: true,
      path: currentOutputPath,
    });
  }
  return new Promise((resolve, reject) => {
    start().then((startResult) => {
      if (!startResult.ok) {
        resolve(startResult);
        return;
      }
      // Wire the pending resolver so the next `stop()` call — whether
      // triggered by hotkey, tray, or renderer — resolves this promise
      // with the final filepath.
      pendingStopResolver = (result) => resolve(result);
    }).catch(reject);
  });
}

function install(context) {
  ctx = context || {};

  ipcMain.on("audioRecorder:started", () => {});
  ipcMain.on("audioRecorder:saved", (_e, payload) => onSaved(payload || {}));
  ipcMain.on("audioRecorder:error", (_e, payload) => onError(payload || {}));

  ipcMain.handle("audioRecorder:start", () => start());
  ipcMain.handle("audioRecorder:stop", () => stop());
  ipcMain.handle("audioRecorder:toggle", () => toggle());
  ipcMain.handle("audioRecorder:status", () => ({
    recording: isRecording,
    path: currentOutputPath,
  }));
  ipcMain.handle("audioRecorder:record", () => recordVoiceMemo());

  let hotkeyRegistered = false;
  try {
    hotkeyRegistered = globalShortcut.register(HOTKEY, () => {
      toggle().catch(err => {
        ctx?.notify?.({ title: "Voice memo error", body: String(err?.message || err) });
      });
    });
  } catch {}

  app.on("will-quit", () => {
    try { globalShortcut.unregister(HOTKEY); } catch {}
    stopTrayPulse();
  });

  return { ok: true, hotkey: HOTKEY, hotkeyRegistered };
}

module.exports = {
  install,
  start,
  stop,
  toggle,
  recordVoiceMemo,
  get isRecording() { return isRecording; },
};
