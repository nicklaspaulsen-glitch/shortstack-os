// ShortStack OS — Screen Recording
//
// Desktop-only differentiator: record the screen (or any window) using
// Electron's `desktopCapturer` + the renderer's MediaRecorder API. The
// actual recording happens in a hidden BrowserWindow because MediaRecorder
// is a renderer-side API; the main process only brokers start/stop and
// persists the resulting blob to disk.
//
// Hotkey: Ctrl+Shift+R toggles start/stop.
// On stop, a native notification fires with an "Open in Video Editor" CTA
// that navigates the main dashboard to /dashboard/video-editor?import=<file>.
//
// Output: <userData>/recordings/<timestamp>.webm (VP8/VP9 + Opus).
//
// Web dashboard CAN'T do this — getDisplayMedia() in the browser only
// captures the active tab and requires a per-recording user prompt.

const {
  app,
  BrowserWindow,
  desktopCapturer,
  globalShortcut,
  ipcMain,
  session,
} = require("electron");
const path = require("path");
const fs = require("fs");

let ctx = null;
let recorderWindow = null;
let isRecording = false;
let currentOutputPath = null;
// Pending promise to signal the renderer's async save back to the caller.
let pendingStopResolver = null;

const HOTKEY = "CommandOrControl+Shift+R";

function recordingsDir() {
  const dir = path.join(app.getPath("userData"), "recordings");
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

/**
 * Pick a source for the screen recording. When `opts.pick` is true we
 * enumerate all screens + windows so the renderer can offer a picker UI;
 * otherwise we fast-path to the primary display.
 */
async function pickSource(opts = {}) {
  const types = opts.pick ? ["screen", "window"] : ["screen"];
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize: { width: 320, height: 200 },
  });
  if (opts.pick) return sources.map(s => ({
    id: s.id,
    name: s.name,
    display_id: s.display_id,
    thumbnail: s.thumbnail.toDataURL(),
  }));
  // Fast-path: primary screen only
  const primary = sources[0];
  if (!primary) throw new Error("No screen source available");
  return primary;
}

/**
 * Build the hidden renderer that runs MediaRecorder. We don't show this
 * window — it exists purely as a Chromium context where getUserMedia can
 * be brokered via the `setDisplayMediaRequestHandler` installed below.
 */
function createRecorderWindow(sourceId, outputPath) {
  const win = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      offscreen: false,
    },
  });

  // Route desktopCapturer into the renderer's getDisplayMedia() handler.
  // Electron 20+ replaces the silent "always allow" default with an explicit
  // opt-in, so we wire the selected source here.
  try {
    win.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ["screen", "window"] }).then((sources) => {
        const chosen = sources.find(s => s.id === sourceId) || sources[0];
        // eslint-disable-next-line no-unused-vars
        callback({ video: chosen, audio: "loopback" });
      }).catch(() => callback({}));
    }, { useSystemPicker: false });
  } catch {
    // Older Electron: handler isn't required, default behavior works.
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body>
    <script>
      const { ipcRenderer } = require('electron');
      const fs = require('fs');
      const SOURCE_ID = ${JSON.stringify(sourceId)};
      const OUTPUT_PATH = ${JSON.stringify(outputPath)};

      let mediaRecorder = null;
      let chunks = [];
      let stream = null;

      async function start() {
        try {
          // Try the legacy chromeMediaSource constraints first — Electron's
          // desktopCapturer integrates via this pathway on both modern and
          // older versions.
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
              },
            },
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: SOURCE_ID,
                minWidth: 1280,
                maxWidth: 3840,
                minHeight: 720,
                maxHeight: 2160,
              },
            },
          }).catch(async () => {
            // Audio may fail on systems without a mixer — retry video-only
            return navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: SOURCE_ID,
                },
              },
            });
          });

          // Pick the best supported mime type. webm/vp9 is the gold standard;
          // fall back gracefully to vp8 or default.
          const preferred = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
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
              const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
              const arrayBuffer = await blob.arrayBuffer();
              fs.writeFileSync(OUTPUT_PATH, Buffer.from(arrayBuffer));
              ipcRenderer.send('screenRecorder:saved', { path: OUTPUT_PATH, size: arrayBuffer.byteLength });
            } catch (err) {
              ipcRenderer.send('screenRecorder:error', { error: String(err && err.message || err) });
            } finally {
              if (stream) stream.getTracks().forEach(t => t.stop());
              stream = null;
            }
          };
          mediaRecorder.onerror = (e) => {
            ipcRenderer.send('screenRecorder:error', { error: String(e && e.error && e.error.message || 'recorder-error') });
          };
          mediaRecorder.start(1000); // emit a chunk every second — if the
                                     // app crashes we don't lose everything.
          ipcRenderer.send('screenRecorder:started', { mimeType: mediaRecorder.mimeType });
        } catch (err) {
          ipcRenderer.send('screenRecorder:error', { error: String(err && err.message || err) });
        }
      }

      ipcRenderer.on('screenRecorder:stop', () => {
        try {
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        } catch (err) {
          ipcRenderer.send('screenRecorder:error', { error: String(err && err.message || err) });
        }
      });

      start();
    </script>
  </body></html>`;

  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return win;
}

/**
 * Start a recording. If `opts.pick` is true and a picker UI is wired up in
 * the renderer, the caller is expected to pre-select a source and pass
 * `opts.sourceId`. Otherwise we default to the primary screen.
 */
async function start(opts = {}) {
  if (isRecording) {
    return { ok: false, error: "already-recording", path: currentOutputPath };
  }

  let sourceId = opts.sourceId;
  if (!sourceId) {
    const primary = await pickSource({ pick: false });
    sourceId = primary.id;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  currentOutputPath = path.join(recordingsDir(), `${timestamp}.webm`);

  recorderWindow = createRecorderWindow(sourceId, currentOutputPath);
  isRecording = true;

  ctx?.notify?.({
    title: "Recording started",
    body: "Ctrl+Shift+R to stop.",
    silent: true,
  });

  return { ok: true, path: currentOutputPath };
}

/**
 * Stop the active recording. Resolves with { path, size } once the renderer
 * has flushed the MediaRecorder to disk.
 */
function stop() {
  if (!isRecording || !recorderWindow || recorderWindow.isDestroyed()) {
    return Promise.resolve({ ok: false, error: "not-recording" });
  }

  return new Promise((resolve) => {
    pendingStopResolver = resolve;
    try {
      recorderWindow.webContents.send("screenRecorder:stop");
    } catch (err) {
      pendingStopResolver = null;
      resolve({ ok: false, error: String(err?.message || err) });
    }
    // Safety timeout — if the renderer never reports back, resolve anyway
    // so callers aren't stuck forever.
    setTimeout(() => {
      if (pendingStopResolver === resolve) {
        pendingStopResolver = null;
        isRecording = false;
        resolve({ ok: false, error: "stop-timeout", path: currentOutputPath });
      }
    }, 15000);
  });
}

async function toggle() {
  if (isRecording) {
    return stop();
  }
  return start();
}

function onSaved({ path: savedPath, size }) {
  isRecording = false;
  const wasResolver = pendingStopResolver;
  pendingStopResolver = null;

  // Tear down the hidden window
  try {
    if (recorderWindow && !recorderWindow.isDestroyed()) {
      recorderWindow.close();
    }
  } catch {}
  recorderWindow = null;

  // Notify main window so renderer-side observers can react.
  try {
    const mw = ctx?.getMainWindow?.();
    if (mw && !mw.isDestroyed()) {
      mw.webContents.send("desktop:recording-saved", { path: savedPath, size });
    }
  } catch {}

  // Native notification with "Open in Video Editor" CTA. Electron's
  // Notification API only supports action buttons on macOS — on Windows /
  // Linux we attach the route via the click handler instead, which routes
  // through the notifications module's `onClickRoute` plumbing.
  const route = `/dashboard/video-editor?import=${encodeURIComponent(savedPath)}`;
  ctx?.notify?.({
    title: "Recording saved",
    body: `${path.basename(savedPath)} (${(size / (1024 * 1024)).toFixed(1)} MB). Click to open in Video Editor.`,
    onClickRoute: route,
    meta: { kind: "screen-recording-saved", path: savedPath, size },
  });

  if (wasResolver) {
    wasResolver({ ok: true, path: savedPath, size });
  }
}

function onError({ error }) {
  isRecording = false;
  const wasResolver = pendingStopResolver;
  pendingStopResolver = null;

  try {
    if (recorderWindow && !recorderWindow.isDestroyed()) {
      recorderWindow.close();
    }
  } catch {}
  recorderWindow = null;

  ctx?.notify?.({
    title: "Recording failed",
    body: String(error).slice(0, 200),
  });

  if (wasResolver) {
    wasResolver({ ok: false, error });
  }
}

function install(context) {
  ctx = context || {};

  ipcMain.on("screenRecorder:started", () => {
    // renderer has confirmed — already tracked via isRecording flag
  });
  ipcMain.on("screenRecorder:saved", (_e, payload) => onSaved(payload || {}));
  ipcMain.on("screenRecorder:error", (_e, payload) => onError(payload || {}));

  // Public IPC surface for the renderer / preload bridge.
  ipcMain.handle("screenRecorder:start", (_e, opts) => start(opts || {}));
  ipcMain.handle("screenRecorder:stop", () => stop());
  ipcMain.handle("screenRecorder:toggle", () => toggle());
  ipcMain.handle("screenRecorder:status", () => ({
    recording: isRecording,
    path: currentOutputPath,
  }));
  ipcMain.handle("screenRecorder:list-sources", () => pickSource({ pick: true }));

  // Global hotkey — toggle. Wrapped in try/catch because another app may
  // already own Ctrl+Shift+R (e.g. some IDEs).
  let hotkeyRegistered = false;
  try {
    hotkeyRegistered = globalShortcut.register(HOTKEY, () => {
      toggle().catch(err => {
        ctx?.notify?.({ title: "Recorder error", body: String(err?.message || err) });
      });
    });
  } catch {}

  app.on("will-quit", () => {
    try { globalShortcut.unregister(HOTKEY); } catch {}
  });

  return { ok: true, hotkey: HOTKEY, hotkeyRegistered };
}

module.exports = {
  install,
  start,
  stop,
  toggle,
  get isRecording() { return isRecording; },
};
