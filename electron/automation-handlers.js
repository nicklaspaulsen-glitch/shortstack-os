/**
 * ShortStack automation handlers — native mouse/keyboard/screenshot bridge
 * (Phase 2 computer-use equivalent).
 *
 * Design goals:
 *   • Zero crashes if the native module isn't installed.
 *   • Registers IPC handlers either way so the renderer API stays stable.
 *   • Returns { success: false, error } when unavailable — never throws.
 *
 * Preferred backends (in priority order):
 *   1. @nut-tree/nut-js   — modern, maintained, supports all platforms
 *   2. robotjs            — classic fallback
 *   3. stub               — returns "automation unavailable" error
 *
 * IPC handlers exposed:
 *   agent:click      { x, y, button?: "left"|"right"|"middle", double?: boolean }
 *   agent:type       { text, delay?: number }
 *   agent:keypress   { key, modifiers?: string[] }
 *   agent:screenshot {}
 *   agent:cursor-pos {}
 *   agent:automation-info {}    — reports which backend is active
 */

const { ipcMain, BrowserWindow, shell } = require("electron");

// ── Try each backend in turn ─────────────────────────────────────
let backend = null;
let backendName = "stub";
let nutJs = null;
let robotJs = null;

try {
  // eslint-disable-next-line global-require
  nutJs = require("@nut-tree/nut-js");
  backend = "nut";
  backendName = "@nut-tree/nut-js";
  // Reduce automation delay so agent actions feel snappy.
  try {
    if (nutJs.keyboard?.config) nutJs.keyboard.config.autoDelayMs = 30;
    if (nutJs.mouse?.config) nutJs.mouse.config.autoDelayMs = 30;
  } catch { /* older versions may not expose config */ }
} catch {
  // nut-js not installed — try robotjs
  try {
    // eslint-disable-next-line global-require
    robotJs = require("robotjs");
    backend = "robot";
    backendName = "robotjs";
  } catch {
    // neither available — stub only
    backend = null;
    backendName = "stub";
  }
}

console.log(`[shortstack] automation backend: ${backendName}`);

// ── Helpers ──────────────────────────────────────────────────────

function unavailable() {
  return {
    success: false,
    error:
      "Native automation not available. Install @nut-tree/nut-js or robotjs to enable AI-assisted mouse/keyboard control.",
    backend: backendName,
  };
}

async function withTimeout(promise, ms = 10000, label = "op") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// ── Click ────────────────────────────────────────────────────────
async function doClick({ x, y, button = "left", double = false }) {
  if (typeof x !== "number" || typeof y !== "number") {
    return { success: false, error: "x and y (numbers) required" };
  }
  if (!backend) return unavailable();

  try {
    if (backend === "nut") {
      await withTimeout(nutJs.mouse.move(nutJs.straightTo(new nutJs.Point(x, y))), 5000, "move");
      const btnMap = { left: nutJs.Button.LEFT, right: nutJs.Button.RIGHT, middle: nutJs.Button.MIDDLE };
      const btn = btnMap[button] ?? nutJs.Button.LEFT;
      if (double) {
        await nutJs.mouse.doubleClick(btn);
      } else {
        await nutJs.mouse.click(btn);
      }
      return { success: true, x, y, button, double };
    }
    if (backend === "robot") {
      robotJs.moveMouse(x, y);
      if (double) robotJs.mouseClick(button, true);
      else robotJs.mouseClick(button);
      return { success: true, x, y, button, double };
    }
    return unavailable();
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── Type text ─────────────────────────────────────────────────────
async function doType({ text, delay }) {
  if (typeof text !== "string") return { success: false, error: "text (string) required" };
  if (!backend) return unavailable();

  try {
    if (backend === "nut") {
      await withTimeout(nutJs.keyboard.type(text), Math.max(5000, text.length * 50), "type");
      return { success: true, length: text.length };
    }
    if (backend === "robot") {
      if (delay) robotJs.setKeyboardDelay(delay);
      robotJs.typeString(text);
      return { success: true, length: text.length };
    }
    return unavailable();
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── Key press ─────────────────────────────────────────────────────
async function doKeypress({ key, modifiers = [] }) {
  if (!key) return { success: false, error: "key (string) required" };
  if (!backend) return unavailable();

  try {
    if (backend === "nut") {
      // Map common key names; nut-js uses the Key enum
      const keyName = String(key).toUpperCase();
      const mods = modifiers
        .map((m) => nutJs.Key[m.toUpperCase()])
        .filter(Boolean);
      const mainKey = nutJs.Key[keyName];
      if (!mainKey) return { success: false, error: `Unknown key: ${key}` };
      await nutJs.keyboard.pressKey(...mods, mainKey);
      await nutJs.keyboard.releaseKey(...mods, mainKey);
      return { success: true, key, modifiers };
    }
    if (backend === "robot") {
      robotJs.keyTap(String(key).toLowerCase(), modifiers.map((m) => m.toLowerCase()));
      return { success: true, key, modifiers };
    }
    return unavailable();
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── Screenshot ────────────────────────────────────────────────────
async function doScreenshot() {
  if (!backend) return unavailable();
  try {
    if (backend === "nut") {
      const img = await withTimeout(nutJs.screen.grab(), 8000, "screenshot");
      // img.data is a raw pixel buffer — we return dimensions; callers can
      // request it saved via save_screenshot if needed.
      return {
        success: true,
        width: img.width,
        height: img.height,
        pixelDensity: img.pixelDensity || 1,
        note: "Raw capture. Use browser-side page capture for lighter payloads.",
      };
    }
    if (backend === "robot") {
      const { width, height } = robotJs.getScreenSize();
      const capture = robotJs.screen.capture(0, 0, width, height);
      return {
        success: true,
        width,
        height,
        byteWidth: capture.byteWidth,
      };
    }
    return unavailable();
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── Cursor position ──────────────────────────────────────────────
async function doCursorPos() {
  if (!backend) return unavailable();
  try {
    if (backend === "nut") {
      const pos = await nutJs.mouse.getPosition();
      return { success: true, x: pos.x, y: pos.y };
    }
    if (backend === "robot") {
      const pos = robotJs.getMousePos();
      return { success: true, x: pos.x, y: pos.y };
    }
    return unavailable();
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

// ── Browser navigate (works with or without backend) ──────────────
// Opens a URL in a BrowserView embedded in the main window if possible,
// otherwise delegates to the OS default browser. Safe either way.
async function doBrowserNavigate({ url }) {
  try {
    if (!url || typeof url !== "string") {
      return { success: false, error: "url (string) required" };
    }
    // Very basic URL validation
    try { new URL(url); } catch { return { success: false, error: "Invalid URL" }; }

    // Try to send to the main window's renderer so it can mount a <webview>
    // in the embedded browser panel. If no listener is registered, fall back
    // to opening externally.
    const win = BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && w.webContents && !w.webContents.isDestroyed(),
    );
    if (win) {
      win.webContents.send("embedded-browser:navigate", { url });
      return { success: true, url, delivery: "embedded" };
    }
    shell.openExternal(url);
    return { success: true, url, delivery: "external" };
  } catch (err) {
    shell.openExternal(url);
    return { success: true, url, delivery: "external-fallback", warning: String(err?.message || err) };
  }
}

// ── Register IPC handlers ─────────────────────────────────────────
function register() {
  // Guard against double registration across reloads in dev.
  const safeHandle = (channel, fn) => {
    try { ipcMain.removeHandler(channel); } catch { /* noop */ }
    ipcMain.handle(channel, async (_event, input) => {
      try { return await fn(input || {}); }
      catch (err) { return { success: false, error: String(err?.message || err) }; }
    });
  };

  safeHandle("agent:click", doClick);
  safeHandle("agent:type", doType);
  safeHandle("agent:keypress", doKeypress);
  safeHandle("agent:screenshot", doScreenshot);
  safeHandle("agent:cursor-pos", doCursorPos);
  safeHandle("agent:browser-navigate", doBrowserNavigate);
  safeHandle("agent:automation-info", async () => ({
    success: true,
    backend: backendName,
    available: Boolean(backend),
  }));
}

// Register immediately on module load — ipcMain is always available
// by the time main.js requires this file.
try {
  register();
} catch (err) {
  console.warn("[shortstack] automation ipc registration failed:", err?.message);
}

module.exports = {
  register,
  backendName,
  available: Boolean(backend),
  // Exposed for direct calls from other main-process code (e.g. agent-runtime)
  click: doClick,
  type: doType,
  keypress: doKeypress,
  screenshot: doScreenshot,
  cursorPos: doCursorPos,
  browserNavigate: doBrowserNavigate,
};
