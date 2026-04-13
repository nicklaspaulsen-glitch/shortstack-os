const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell, Notification } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

const agentRuntime = require("./agent-runtime");

let mainWindow;
let splashWindow;
let agentWindow;
let tray;
let updateAvailable = null;
let updateInProgress = false;

const APP_URL = "https://shortstack-os.vercel.app";
const LICENSE_FILE = path.join(app.getPath("userData"), "license.json");
const SETTINGS_FILE = path.join(app.getPath("userData"), "app-settings.json");
const SESSION_FILE = path.join(app.getPath("userData"), "agent-session.json");
// Read version from package.json directly — app.getVersion() returns the
// Electron framework version in dev mode, causing false update prompts.
const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
    return pkg.version || app.getVersion() || "1.0.0";
  } catch {
    return app.getVersion() || "1.0.0";
  }
})();

// ── Agent Session Management ─────────────────────────────────
let agentSession = null; // { access_token, refresh_token, expires_at, user }

function loadAgentSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      agentSession = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
      return agentSession;
    }
  } catch {}
  return null;
}

function saveAgentSession(session) {
  agentSession = session;
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
}

function clearAgentSession() {
  agentSession = null;
  try { fs.unlinkSync(SESSION_FILE); } catch {}
}

async function refreshSessionIfNeeded() {
  if (!agentSession) return false;

  // Check if token expires within 5 minutes
  const expiresAt = agentSession.expires_at * 1000; // convert to ms
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() < expiresAt - fiveMinutes) return true; // still valid

  try {
    const { net } = require("electron");
    const res = await net.fetch(APP_URL + "/api/agents/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "refresh",
        refresh_token: agentSession.refresh_token,
      }),
    });

    if (!res.ok) {
      clearAgentSession();
      return false;
    }

    const data = await res.json();
    saveAgentSession(data);
    return true;
  } catch {
    return false;
  }
}

/** Build headers with auth token for agent API calls */
function agentHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (agentSession?.access_token) {
    headers["Authorization"] = `Bearer ${agentSession.access_token}`;
  }
  return headers;
}

// Load session on startup
loadAgentSession();

// ── App Settings ──────────────────────────────────────────────
function getAppSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {}
  return { autoStartup: false, autoUpdate: true };
}

function saveAppSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// Apply auto-startup setting
function applyAutoStartup(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: app.getPath("exe"),
  });
}

// IPC handlers for settings
ipcMain.handle("get-app-settings", () => getAppSettings());
ipcMain.handle("set-app-settings", (_, settings) => {
  saveAppSettings(settings);
  applyAutoStartup(settings.autoStartup);
  return { success: true };
});
ipcMain.handle("get-app-version", () => APP_VERSION);

// ── License helpers ──────────────────────────────────────────────

function getLicense() {
  try {
    if (fs.existsSync(LICENSE_FILE)) return JSON.parse(fs.readFileSync(LICENSE_FILE, "utf8"));
  } catch {}
  return null;
}

function saveLicense(data) {
  fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
}

function isTrialExpired(license) {
  if (license?.type !== "trial") return false;
  return new Date(license.trial_ends) < new Date();
}

// ── Auto-update checker ─────────────────────────────────────────

// Track which versions the user has already dismissed so we don't re-prompt
let dismissedVersion = null;

async function checkForUpdates() {
  if (updateInProgress) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    const { net } = require("electron");
    const res = await net.fetch(APP_URL + "/api/app/version");
    const data = await res.json();

    if (!data.version || data.version === APP_VERSION) return; // up to date
    if (data.version === dismissedVersion) return; // already dismissed this version

    updateAvailable = data;
    const hasInstaller = !!data.download_url;

    if (!hasInstaller) {
      // Web-only update — no .exe to download. Just silently clear cache.
      // The web deploy checker will show a subtle refresh banner if build_id
      // changes. No blocking dialog needed — that was causing an infinite
      // reload loop since the version mismatch never resolves for Electron.
      await mainWindow.webContents.session.clearCache();
      return;
    }

    // Has a real installer URL — show the download dialog
    const result = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Available",
      message: `ShortStack OS v${data.version}`,
      detail: `${data.release_notes || "New features and improvements available."}\n\nWould you like to download and install it now?`,
      buttons: ["Update Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0 && mainWindow && !mainWindow.isDestroyed()) {
      downloadAndInstallUpdate(data.download_url, data.version);
    } else {
      dismissedVersion = data.version; // don't re-prompt until next app restart
    }
  } catch {
    // Silent fail — no internet or API down
  }
}

// ── Web deploy checker ──────────────────────────────────────────
// Polls /api/app/version every 5 minutes. If the build_id changed,
// shows a subtle in-app banner so the user can refresh to get new features.
let lastBuildId = null;
let deployCheckInterval = null;

function startWebDeployChecker() {
  if (deployCheckInterval) return;

  // Capture initial build_id
  const { net } = require("electron");
  net.fetch(APP_URL + "/api/app/version")
    .then(r => r.json())
    .then(d => { lastBuildId = d.build_id; })
    .catch(() => {});

  deployCheckInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const res = await net.fetch(APP_URL + "/api/app/version");
      const data = await res.json();
      if (lastBuildId && data.build_id && data.build_id !== lastBuildId) {
        lastBuildId = data.build_id; // don't show again for same deploy
        mainWindow.webContents.executeJavaScript(`
          (function() {
            if (document.getElementById('ss-deploy-banner')) return;
            const b = document.createElement('div');
            b.id = 'ss-deploy-banner';
            b.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;background:#0c1017;border:1px solid rgba(200,168,85,0.3);color:#C9A84C;padding:10px 16px;border-radius:12px;font-family:Inter,system-ui,sans-serif;font-size:12px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.4);-webkit-app-region:no-drag;cursor:default;';
            b.innerHTML = '<span style="font-size:14px;">✨</span><span style="color:#94a3b8;">New update available</span><button onclick="window.location.reload()" style="background:#C9A84C;color:#000;border:none;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;">Refresh</button><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:14px;padding:0 4px;">✕</button>';
            document.body.appendChild(b);
            setTimeout(() => { if (b.parentElement) b.remove(); }, 30000);
          })();
        `);
      }
    } catch {}
  }, 5 * 60 * 1000); // every 5 minutes
}

function downloadAndInstallUpdate(url, version) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!url) { updateInProgress = false; return; } // guard against empty URL
  updateInProgress = true;

  // Safety timeout — reset flag after 5 minutes so the app isn't stuck
  setTimeout(() => { updateInProgress = false; }, 5 * 60 * 1000);

  // Show progress in-app
  mainWindow.webContents.executeJavaScript(`
    (function() {
      if (document.getElementById('ss-update-banner')) document.getElementById('ss-update-banner').remove();
      const banner = document.createElement('div');
      banner.id = 'ss-update-banner';
      banner.style.cssText = 'position:fixed;top:36px;left:0;right:0;z-index:99999;background:#0c1017;border-bottom:1px solid #1e2a3a;color:#C9A84C;padding:8px 16px;display:flex;align-items:center;gap:12px;font-family:Inter,system-ui,sans-serif;font-size:11px;-webkit-app-region:no-drag;';
      banner.innerHTML = '<div style="flex:1;"><div style="color:#94a3b8;margin-bottom:4px;">Downloading v${version}...</div><div style="width:100%;height:4px;background:#1e2a3a;border-radius:2px;overflow:hidden;"><div id="ss-update-progress" style="width:0%;height:100%;background:#C9A84C;border-radius:2px;transition:width 0.3s;"></div></div></div>';
      document.body.prepend(banner);
      // Auto-remove banner after 60s if download never completes (stale protection)
      setTimeout(function() { var b = document.getElementById('ss-update-banner'); if (b) b.remove(); }, 60000);
    })();
  `);

  // Use Electron's Chromium download manager — handles GitHub redirects, SSL, etc.
  const ses = mainWindow.webContents.session;

  // One-time listener for this specific download
  ses.once("will-download", (event, item) => {
    const tmpPath = path.join(app.getPath("temp"), "ShortStack-OS-Update.exe");
    item.setSavePath(tmpPath);

    item.on("updated", (event, state) => {
      if (state === "progressing" && !item.isPaused()) {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        if (total > 0 && mainWindow && !mainWindow.isDestroyed()) {
          const pct = Math.round((received / total) * 100);
          mainWindow.webContents.executeJavaScript(
            `document.getElementById('ss-update-progress')&&(document.getElementById('ss-update-progress').style.width='${pct}%')`
          ).catch(() => {});
        }
      }
    });

    item.once("done", (event, state) => {
      if (state === "completed" && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: "info",
          title: "Download Complete",
          message: "Update downloaded successfully",
          detail: "The app will close and the installer will open. Follow the prompts to update.",
          buttons: ["Install Now"],
        }).then(() => {
          const { exec } = require("child_process");
          exec(`"${tmpPath}"`);
          app.quit();
        });
      } else {
        updateInProgress = false;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`
            document.getElementById('ss-update-banner')&&(document.getElementById('ss-update-banner').innerHTML='<span style="color:#f43f5e;">Download failed. </span><button onclick="require(\\'electron\\').shell.openExternal(\\'${url}\\')" style="color:#C9A84C;background:none;border:none;cursor:pointer;text-decoration:underline;">Download manually</button>');
          `).catch(() => {});
        }
      }
    });
  });

  // Trigger the download through Chromium's network stack
  mainWindow.webContents.downloadURL(url);
}

// ── Splash / License screen ─────────────────────────────────────

function createSplash() {
  const license = getLicense();
  const isActive = license?.activated && !isTrialExpired(license);

  splashWindow = new BrowserWindow({
    width: 480, height: isActive ? 480 : 600, frame: false, resizable: false,
    backgroundColor: "#06080c",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  // ── Embed actual logo PNG as base64 data URI ──
  let logoPNG = "";
  try {
    logoPNG = "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "../public/icons/shortstack-logo.png")).toString("base64");
  } catch { /* SVG fallback below */ }

  const logoEl = logoPNG
    ? `<img src="${logoPNG}" style="width:80px;height:80px;border-radius:18px;" />`
    : `<svg width="80" height="80" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#D4B85A"/><stop offset="50%" stop-color="#C9A84C"/><stop offset="100%" stop-color="#A8893D"/></linearGradient></defs><rect width="512" height="512" rx="108" fill="#0c1017"/><rect x="136" y="310" width="240" height="36" rx="8" fill="url(#g)" opacity=".4"/><rect x="116" y="262" width="280" height="36" rx="8" fill="url(#g)" opacity=".65"/><rect x="96" y="214" width="320" height="36" rx="8" fill="url(#g)"/><path d="M268 120L238 200L270 200L248 280L310 180L274 180L300 120Z" fill="url(#g)" opacity=".9"/></svg>`;

  // ── Shared base styles ──
  const baseCSS = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#06080c;color:#e2e8f0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden;-webkit-app-region:drag}
    .no-drag{-webkit-app-region:no-drag}

    /* ── Background effects ── */
    .bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(201,168,76,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.03) 1px,transparent 1px);background-size:36px 36px;-webkit-mask-image:radial-gradient(ellipse 55% 55% at 50% 45%,black,transparent);animation:gridIn 2s ease forwards;opacity:0}
    @keyframes gridIn{to{opacity:1}}
    .bg-glow{position:fixed;top:-100px;left:50%;transform:translateX(-50%);width:550px;height:550px;background:radial-gradient(ellipse,rgba(201,168,76,0.12) 0%,rgba(201,168,76,0.03) 35%,transparent 65%);pointer-events:none;animation:breathe 4s ease-in-out infinite}
    @keyframes breathe{0%,100%{opacity:.5;transform:translateX(-50%) scale(1)}50%{opacity:1;transform:translateX(-50%) scale(1.06)}}

    /* ── Floating particles ── */
    .particle{position:fixed;width:2px;height:2px;background:rgba(201,168,76,0.25);border-radius:50%;animation:float linear infinite;pointer-events:none}
    @keyframes float{0%{transform:translateY(100vh) scale(0);opacity:0}10%{opacity:1;transform:translateY(90vh) scale(1)}90%{opacity:.6}100%{transform:translateY(-20px) scale(0);opacity:0}}
    .p1{left:8%;animation-duration:14s;animation-delay:0s}.p2{left:18%;animation-duration:18s;animation-delay:2s;width:3px;height:3px}.p3{left:32%;animation-duration:12s;animation-delay:.8s}.p4{left:48%;animation-duration:20s;animation-delay:3.5s;width:1px;height:1px}.p5{left:62%;animation-duration:15s;animation-delay:.3s}.p6{left:78%;animation-duration:17s;animation-delay:2.2s;width:3px;height:3px}.p7{left:88%;animation-duration:13s;animation-delay:1.2s}.p8{left:42%;animation-duration:16s;animation-delay:4s;width:1px;height:1px}

    /* ── Logo with orbital ring ── */
    .logo-wrap{position:relative;width:150px;height:150px;display:flex;align-items:center;justify-content:center;margin-bottom:24px}
    .logo-wrap img,.logo-wrap>svg{animation:logoIn .8s cubic-bezier(.16,1,.3,1) forwards;opacity:0;filter:drop-shadow(0 0 30px rgba(201,168,76,.25))}
    @keyframes logoIn{from{opacity:0;transform:scale(.65) translateY(14px)}to{opacity:1;transform:scale(1) translateY(0)}}
    .orbit-ring{position:absolute;inset:4px;border-radius:50%;border:1px solid rgba(201,168,76,.08)}
    .orbit-ring-2{position:absolute;inset:16px;border-radius:50%;border:1px dashed rgba(201,168,76,.04)}
    .orbit{position:absolute;inset:4px;border-radius:50%;animation:spin 10s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .dot{position:absolute;width:5px;height:5px;border-radius:50%;background:#C9A84C}
    .dot-1{top:-2px;left:50%;transform:translateX(-50%);box-shadow:0 0 10px rgba(201,168,76,.8),0 0 25px rgba(201,168,76,.3)}
    .dot-2{bottom:-2px;left:50%;transform:translateX(-50%);opacity:.25;box-shadow:0 0 6px rgba(201,168,76,.3);width:3px;height:3px}
    .dot-3{top:50%;right:-2px;transform:translateY(-50%);opacity:.45;box-shadow:0 0 8px rgba(201,168,76,.4);width:4px;height:4px}

    /* ── Staggered fade-slide ── */
    .fs{animation:fadeSlide .6s ease-out forwards;opacity:0}
    @keyframes fadeSlide{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
    .d1{animation-delay:.15s}.d2{animation-delay:.3s}.d3{animation-delay:.45s}.d4{animation-delay:.6s}.d5{animation-delay:.75s}.d6{animation-delay:.9s}.d7{animation-delay:1.05s}

    /* ── Gold gradient text ── */
    .gold-text{background:linear-gradient(135deg,#E8D48B 0%,#D4B85A 30%,#C9A84C 60%,#A8893D 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 20px rgba(201,168,76,.15))}
    .muted{color:#475569}.dim{color:#1e2a3a}.danger{color:#f43f5e}
  `;

  // ── Particles HTML (shared by both screens) ──
  const particlesHTML = `<div class="particle p1"></div><div class="particle p2"></div><div class="particle p3"></div><div class="particle p4"></div><div class="particle p5"></div><div class="particle p6"></div><div class="particle p7"></div><div class="particle p8"></div>`;

  // ── Logo wrap HTML (shared) ──
  const logoWrapHTML = `<div class="logo-wrap"><div class="orbit-ring"></div><div class="orbit-ring-2"></div><div class="orbit"><div class="dot dot-1"></div><div class="dot dot-2"></div><div class="dot dot-3"></div></div>${logoEl}</div>`;

  if (isActive) {
    // ── ACTIVE SPLASH — premium loading screen ──
    const trialInfo = license.type === "trial"
      ? "Trial \u00B7 " + Math.max(0, Math.ceil((new Date(license.trial_ends) - Date.now()) / 86400000)) + " days remaining"
      : "Full License";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <style>${baseCSS}
      .progress-track{width:180px;height:3px;background:rgba(201,168,76,.08);border-radius:3px;overflow:hidden;position:relative}
      .progress-fill{width:0%;height:100%;background:linear-gradient(90deg,#A8893D,#C9A84C,#E8D48B);border-radius:3px;animation:pFill 1.4s cubic-bezier(.4,0,.2,1) .4s forwards;position:relative}
      .progress-fill::after{content:'';position:absolute;top:0;right:0;bottom:0;width:40px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent);animation:shimmer 1.4s ease-in-out .6s forwards;opacity:0}
      @keyframes pFill{0%{width:0}35%{width:50%}70%{width:85%}100%{width:100%}}
      @keyframes shimmer{0%{opacity:0;right:100%}30%{opacity:1}100%{opacity:0;right:-20%}}
      .status{display:inline-flex;align-items:center;gap:8px;background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.12);border-radius:24px;padding:7px 18px;font-size:11px;font-weight:600;color:#10b981;backdrop-filter:blur(8px)}
      .s-dot{width:6px;height:6px;border-radius:50%;background:#10b981;animation:pulse 2s ease-in-out infinite}
      @keyframes pulse{0%,100%{opacity:.3;box-shadow:0 0 0 0 rgba(16,185,129,.4)}50%{opacity:1;box-shadow:0 0 0 6px rgba(16,185,129,0)}}
      .loading-text{font-size:10px;color:#3a4a5e;margin-top:10px;overflow:hidden}
      .loading-text span{display:inline-block;animation:textCycle 1.4s ease-in-out .4s forwards}
      @keyframes textCycle{0%{opacity:0;transform:translateY(8px)}20%{opacity:1;transform:translateY(0)}80%{opacity:1;transform:translateY(0)}100%{opacity:.5;transform:translateY(0)}}
    </style>
    <body>
      <div class="bg-grid"></div>
      <div class="bg-glow"></div>
      ${particlesHTML}
      ${logoWrapHTML}
      <div class="fs d1 gold-text" style="font-size:30px;font-weight:800;letter-spacing:-1px">ShortStack</div>
      <div class="fs d2" style="font-size:9px;letter-spacing:6px;color:#2a3548;margin-top:6px;font-weight:600">AGENCY OPERATING SYSTEM</div>
      <div class="fs d3" style="margin-top:30px"><div class="progress-track"><div class="progress-fill"></div></div></div>
      <div class="fs d4 loading-text"><span>Initializing workspace\u2026</span></div>
      <div class="fs d5 status" style="margin-top:22px"><div class="s-dot"></div>License Active \u2014 ${license.tier}</div>
      <div class="fs d6 muted" style="font-size:10px;margin-top:6px">${trialInfo}</div>
      <div class="fs d7 dim" style="position:absolute;bottom:14px;font-size:9px;letter-spacing:2px">v${APP_VERSION}</div>
      <script>setTimeout(()=>require('electron').ipcRenderer.send('launch-app'),1600)</script>
    </body></html>`;

    splashWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    return;
  }

  // ── INACTIVE SPLASH — activation / trial form ──
  const expiredMsg = isTrialExpired(license) ? '<div class="fs d2 danger" style="font-size:11px;margin-top:8px">Your trial has expired. Activate a license to continue.</div>' : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <style>${baseCSS}
    input{width:100%;background:#0a0d14;border:1px solid #1e2a3a;border-radius:10px;padding:11px 14px;color:white;font-size:13px;outline:none;margin-bottom:10px;transition:border-color .2s,box-shadow .2s;-webkit-app-region:no-drag}
    input:focus{border-color:rgba(201,168,76,.5);box-shadow:0 0 0 3px rgba(201,168,76,.06)}
    input::placeholder{color:#3a4a5e}
    .btn{width:100%;border:none;border-radius:10px;padding:12px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;-webkit-app-region:no-drag}
    .btn-gold{background:linear-gradient(135deg,#C9A84C,#D4B85A,#A8893D);color:#0b0d12}
    .btn-gold:hover{box-shadow:0 0 20px rgba(201,168,76,.3);transform:translateY(-1px)}
    .btn-ghost{background:rgba(255,255,255,.03);color:#94a3b8;border:1px solid #1e2a3a}
    .btn-ghost:hover{border-color:#2e3e52;color:#e2e8f0;background:rgba(255,255,255,.05)}
    .tab-row{display:flex;gap:4px;margin-bottom:16px;background:rgba(255,255,255,.02);border-radius:10px;padding:3px;border:1px solid #1e2a3a}
    .tab{flex:1;padding:8px;text-align:center;font-size:11px;font-weight:600;border-radius:8px;cursor:pointer;transition:all .2s;color:#64748b;-webkit-app-region:no-drag}
    .tab.active{background:rgba(201,168,76,.1);color:#C9A84C}
    .tab:not(.active):hover{color:#94a3b8}
    .panel{display:none}.panel.active{display:block}
    .divider{display:flex;align-items:center;gap:12px;margin:14px 0}
    .divider::before,.divider::after{content:'';flex:1;height:1px;background:#1e2a3a}
    .divider span{font-size:9px;color:#3a4a5e;text-transform:uppercase;letter-spacing:1px}
    .features{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:16px}
    .feature{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.04);border-radius:8px;padding:8px 10px;text-align:center;transition:border-color .3s}
    .feature:hover{border-color:rgba(201,168,76,.15)}
    .feature .icon{font-size:14px;margin-bottom:3px}
    .feature .label{font-size:9px;color:#64748b}
    a{color:#C9A84C;text-decoration:none}a:hover{text-decoration:underline}
  </style>
  <body>
    <div class="bg-grid"></div>
    <div class="bg-glow"></div>
    ${particlesHTML}
    <div style="text-align:center;margin-bottom:12px">
      <div style="display:flex;justify-content:center">${logoWrapHTML}</div>
      <div class="fs d1 gold-text" style="font-size:24px;font-weight:800;letter-spacing:-.5px">ShortStack OS</div>
      <div class="fs d2" style="font-size:9px;color:#2a3548;margin-top:4px;letter-spacing:3px;font-weight:500">YOUR AI-POWERED AGENCY</div>
      ${expiredMsg}
    </div>
    <div class="fs d3 no-drag" style="width:100%;padding:0 32px">
      <div class="tab-row">
        <div class="tab active" onclick="switchTab('license')">License Key</div>
        <div class="tab" onclick="switchTab('trial')">Free Trial</div>
      </div>
      <div class="panel active" id="panel-license">
        <input id="key" placeholder="Enter your license key">
        <input id="email-license" type="email" placeholder="Email address">
        <div id="err" class="danger" style="font-size:10px;margin-bottom:8px;display:none"></div>
        <button class="btn btn-gold" onclick="activate()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>
          Activate License
        </button>
      </div>
      <div class="panel" id="panel-trial">
        <input id="email-trial" type="email" placeholder="Enter your email to start">
        <div id="err2" class="danger" style="font-size:10px;margin-bottom:8px;display:none"></div>
        <button class="btn btn-gold" onclick="trial()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Start 14-Day Free Trial
        </button>
        <div style="text-align:center;margin-top:10px;font-size:10px;color:#3a4a5e">No credit card required</div>
      </div>
      <div class="divider"><span>or</span></div>
      <button class="btn btn-ghost" onclick="require('electron').shell.openExternal('https://shortstack.work/pricing')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
        Create Account at shortstack.work
      </button>
      <div class="features fs d5">
        <div class="feature"><div class="icon">&#x26A1;</div><div class="label">AI Agents</div></div>
        <div class="feature"><div class="icon">&#x1F4E8;</div><div class="label">Outreach</div></div>
        <div class="feature"><div class="icon">&#x1F3AF;</div><div class="label">Lead Engine</div></div>
        <div class="feature"><div class="icon">&#x1F4CA;</div><div class="label">Analytics</div></div>
      </div>
    </div>
    <div class="fs d6 dim" style="position:absolute;bottom:12px;font-size:9px;letter-spacing:2px">v${APP_VERSION}</div>
    <script>
      const{ipcRenderer,shell}=require('electron');
      function switchTab(t){document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));document.querySelector('.tab-row').children[t==='license'?0:1].classList.add('active');document.getElementById('panel-'+t).classList.add('active');clearErrs()}
      function clearErrs(){document.getElementById('err').style.display='none';document.getElementById('err2').style.display='none'}
      function activate(){const k=document.getElementById('key').value.trim(),e=document.getElementById('email-license').value.trim();if(!k){showErr('err','Enter your license key');return}ipcRenderer.send('activate-license',{key:k,email:e||''})}
      function trial(){const e=document.getElementById('email-trial').value.trim();if(!e){showErr('err2','Enter your email address');return}ipcRenderer.send('start-trial',{email:e})}
      function showErr(id,m){const el=document.getElementById(id);el.style.display='block';el.textContent=m}
      ipcRenderer.on('activation-error',(ev,m)=>showErr('err',m));
    </script>
  </body></html>`;

  splashWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

// ── Main window ─────────────────────────────────────────────────

function createMainWindow() {
  const license = getLicense();

  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 700,
    title: "ShortStack OS",
    icon: path.join(__dirname, "../public/icons/shortstack-logo.png"),
    backgroundColor: "#06080c",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: !app.isPackaged,
    },
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#06080c", symbolColor: "#64748b", height: 32 },
    autoHideMenuBar: true,
    show: false,
  });

  // Smooth loading — show when DOM is ready, not after full load
  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show();
  });

  // Handle external links — open in browser, not in-app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Nuclear cache clear — wipe everything to guarantee latest version
  Promise.all([
    mainWindow.webContents.session.clearCache(),
    mainWindow.webContents.session.clearStorageData({
      storages: ["appcache", "cachestorage", "serviceworkers", "shadercache"],
    }),
    mainWindow.webContents.session.clearCodeCaches({}),
  ]).catch(() => {}).then(() => {
    mainWindow.loadURL(APP_URL + "/login?v=" + Date.now());
  });

  // Enable Ctrl+Shift+R to force reload, Ctrl+Shift+A to open agent
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.shift && input.key === "R") {
      mainWindow.webContents.session.clearCache().then(() => {
        mainWindow.webContents.reloadIgnoringCache();
      });
    }
    if (input.control && input.shift && input.key === "A") {
      createAgentWindow();
    }
    // F5 to reload
    if (input.key === "F5") {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });
  mainWindow.on("closed", () => { mainWindow = null; });

  // Check for updates after page loads
  mainWindow.webContents.on("did-finish-load", () => {
    // Clean up any stale update/download banners from previous sessions
    mainWindow.webContents.executeJavaScript(`
      (function() {
        var b = document.getElementById('ss-update-banner');
        if (b) b.remove();
        var d = document.getElementById('ss-deploy-banner');
        if (d) d.remove();
      })();
    `).catch(() => {});

    // Reset stuck download flag on fresh page load
    updateInProgress = false;

    checkForUpdates();
    startWebDeployChecker();
  });

  // Application menu (none — clean look)
  Menu.setApplicationMenu(null);

  // System tray
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "../public/icons/shortstack-logo.png"));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip("ShortStack OS");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open ShortStack OS", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
      { label: "Open AI Agent", click: () => createAgentWindow() },
      { type: "separator" },
      { label: `${license?.tier || "Trial"} Plan`, enabled: false },
      { label: `v${APP_VERSION}`, enabled: false },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]));
    tray.on("double-click", () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
  } catch {}
}

// ── IPC handlers ────────────────────────────────────────────────

ipcMain.on("activate-license", async (event, { key, email }) => {
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key)) {
    event.reply("activation-error", "Invalid key format: XXXX-XXXX-XXXX-XXXX");
    return;
  }

  // Validate against the API
  try {
    const { net } = require("electron");
    const machineId = require("os").hostname();
    const res = await net.fetch(APP_URL + "/api/license/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_key: key.toUpperCase(), email, machine_id: machineId }),
    });
    const data = await res.json();

    if (data.valid) {
      saveLicense({
        key: key.toUpperCase(),
        email: data.email,
        tier: data.tier.charAt(0).toUpperCase() + data.tier.slice(1),
        activated: true,
        activated_at: new Date().toISOString(),
        expires_at: data.expires_at,
        type: "license",
      });
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      createSplash();
    } else {
      event.reply("activation-error", data.error || "Invalid license");
    }
  } catch (err) {
    // Offline fallback: accept key format but mark as unverified
    event.reply("activation-error", "Could not connect to license server. Check your internet connection.");
  }
});

ipcMain.on("start-trial", async (event, { email }) => {
  if (!email) {
    event.reply("activation-error", "Enter your email");
    return;
  }

  // Create a checkout session for a trial via the API
  try {
    const { net } = require("electron");
    const res = await net.fetch(APP_URL + "/api/license/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "growth", email }),
    });
    const data = await res.json();

    if (data.success && data.license_key) {
      // Save trial license locally
      const ends = new Date(); ends.setDate(ends.getDate() + 14);
      saveLicense({
        key: data.license_key,
        email,
        tier: "Growth",
        activated: true,
        activated_at: new Date().toISOString(),
        trial_ends: ends.toISOString(),
        type: "trial",
      });

      // Open checkout in browser for payment setup
      if (data.checkout_url) {
        shell.openExternal(data.checkout_url);
      }

      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      createSplash();
    } else {
      // Fallback: create local trial without Stripe
      const ends = new Date(); ends.setDate(ends.getDate() + 14);
      saveLicense({
        email,
        tier: "Growth",
        activated: true,
        activated_at: new Date().toISOString(),
        trial_ends: ends.toISOString(),
        type: "trial",
      });
      if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
      createSplash();
    }
  } catch {
    // Offline fallback: local trial
    const ends = new Date(); ends.setDate(ends.getDate() + 14);
    saveLicense({
      email,
      tier: "Growth",
      activated: true,
      activated_at: new Date().toISOString(),
      trial_ends: ends.toISOString(),
      type: "trial",
    });
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    createSplash();
  }
});

ipcMain.on("launch-app", () => createMainWindow());

// ── Agent Window ───────────────────────────────────────────────

function createAgentWindow() {
  if (agentWindow && !agentWindow.isDestroyed()) {
    agentWindow.show();
    agentWindow.focus();
    return;
  }

  agentWindow = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 380,
    minHeight: 500,
    title: "ShortStack Agent",
    icon: path.join(__dirname, "../public/icons/shortstack-logo.png"),
    backgroundColor: "#06080c",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload-agent.js"),
      devTools: !app.isPackaged,
    },
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#06080c", symbolColor: "#64748b", height: 36 },
    autoHideMenuBar: true,
    alwaysOnTop: false,
    show: false,
  });

  agentWindow.loadFile(path.join(__dirname, "agent-ui.html"));
  agentWindow.once("ready-to-show", () => agentWindow.show());
  agentWindow.on("closed", () => { agentWindow = null; });
}

// ── Agent Auth IPC handlers ───────────────────────────────────

ipcMain.handle("agent:login", async (event, email, password) => {
  try {
    const { net } = require("electron");
    const res = await net.fetch(APP_URL + "/api/agents/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || "Login failed" };
    }

    saveAgentSession(data);
    return { success: true, user: data.user };
  } catch (err) {
    return { error: String(err) };
  }
});

ipcMain.handle("agent:logout", () => {
  clearAgentSession();
  return { success: true };
});

ipcMain.handle("agent:get-session", () => {
  if (agentSession?.user) {
    return { authenticated: true, user: agentSession.user };
  }
  return { authenticated: false };
});

// ── Agent IPC handlers ─────────────────────────────────────────

ipcMain.handle("agent:workspace", () => agentRuntime.WORKSPACE);

ipcMain.handle("agent:chat", async (event, messages) => {
  try {
    if (!agentSession) return { error: "Not authenticated. Please log in." };
    await refreshSessionIfNeeded();

    const { net } = require("electron");

    // Build Anthropic-formatted messages from conversation history
    const apiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // AI loop: call API → execute tools → repeat until text response
    let toolLogs = [];
    let maxIterations = 10;

    while (maxIterations-- > 0) {
      const res = await net.fetch(APP_URL + "/api/agents/client-agent", {
        method: "POST",
        headers: agentHeaders(),
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { error: `API error ${res.status}: ${errText}` };
      }

      const data = await res.json();

      if (data.error) return { error: data.error };

      // If no tool calls, return the text response
      if (!data.tool_calls || data.tool_calls.length === 0) {
        logAgentActivity(toolLogs); // fire-and-forget
        return { text: data.text, toolLogs };
      }

      // Has tool calls — execute them locally
      // First add the assistant message with tool_use to history
      apiMessages.push({ role: "assistant", content: data.content });

      const toolResults = [];
      for (const tool of data.tool_calls) {
        // Notify renderer about tool execution
        if (agentWindow && !agentWindow.isDestroyed()) {
          agentWindow.webContents.send("agent:tool-exec", {
            name: tool.name,
            input: tool.input,
            result: `Executing ${tool.name}...`,
            success: true,
          });
        }

        const result = await agentRuntime.executeTool(tool.name, tool.input);
        const resultStr = result.success
          ? result.content || result.stdout || result.path || JSON.stringify(result.items || result)
          : `Error: ${result.error}`;

        toolLogs.push({
          name: tool.name,
          input: tool.input,
          result: resultStr.slice(0, 500),
          success: result.success,
        });

        // Notify renderer with result
        if (agentWindow && !agentWindow.isDestroyed()) {
          agentWindow.webContents.send("agent:tool-exec", {
            name: tool.name,
            result: resultStr.slice(0, 300),
            success: result.success,
          });
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: resultStr.slice(0, 10000),
        });
      }

      // Add tool results to history and continue loop
      apiMessages.push({ role: "user", content: toolResults });
    }

    logAgentActivity(toolLogs); // fire-and-forget
    return { text: "Agent reached maximum iteration limit.", toolLogs };
  } catch (err) {
    return { error: String(err) };
  }
});

// ── Activity Logger ─────────────────────────────────────────────
// Logs agent tool executions to the server for audit & analytics.

async function logAgentActivity(toolLogs) {
  if (!agentSession || !toolLogs || toolLogs.length === 0) return;
  try {
    const { net } = require("electron");
    await net.fetch(APP_URL + "/api/agents/activity", {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ actions: toolLogs }),
    });
  } catch {
    // Silent fail — logging should never block the agent
  }
}

// ── Agent Sync IPC handlers ───────────────────────────────────

/**
 * Recursively scan a directory, collecting file/dir metadata.
 * Skips node_modules, .git, .trash. Caps at maxFiles entries.
 */
function scanWorkspace(dir, baseDir, items, maxFiles) {
  if (items.length >= maxFiles) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (items.length >= maxFiles) return;
    const skip = ["node_modules", ".git", ".trash"];
    if (skip.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      // Check if this looks like a project
      const hasReadme = fs.existsSync(path.join(fullPath, "README.md"));
      const hasIndex = fs.existsSync(path.join(fullPath, "index.html"));
      items.push({
        path: relPath,
        type: (hasReadme || hasIndex) ? "project" : "dir",
        size: 0,
        modified: null,
      });
      scanWorkspace(fullPath, baseDir, items, maxFiles);
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        items.push({
          path: relPath,
          type: "file",
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      } catch {
        items.push({ path: relPath, type: "file", size: 0, modified: null });
      }
    }
  }
}

ipcMain.handle("agent:sync-workspace", async () => {
  try {
    const { net } = require("electron");
    const workspace = agentRuntime.WORKSPACE;
    if (!fs.existsSync(workspace)) {
      return { error: "Workspace directory does not exist" };
    }
    const items = [];
    scanWorkspace(workspace, workspace, items, 500);

    const files = items.filter(i => i.type !== "project" && i.type !== "dir");
    const projects = items.filter(i => i.type === "project").map(p => ({
      name: p.path.split("/").pop(),
      type: "project",
      file_count: items.filter(f => f.path.startsWith(p.path + "/")).length,
    }));
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

    await refreshSessionIfNeeded();
    const res = await net.fetch(APP_URL + "/api/agents/sync", {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ workspace_path: workspace, files, projects }),
    });
    const data = await res.json();
    return { files, projects, totalSize, ...data };
  } catch (err) {
    return { error: String(err) };
  }
});

ipcMain.handle("agent:get-tasks", async () => {
  try {
    if (!agentSession) return { error: "Not authenticated" };
    await refreshSessionIfNeeded();
    const { net } = require("electron");
    const res = await net.fetch(APP_URL + "/api/agents/sync", {
      headers: agentHeaders(),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: String(err) };
  }
});

ipcMain.handle("agent:complete-task", async (event, taskId) => {
  try {
    if (!agentSession) return { error: "Not authenticated" };
    await refreshSessionIfNeeded();
    const { net } = require("electron");
    const res = await net.fetch(APP_URL + "/api/agents/sync", {
      method: "POST",
      headers: agentHeaders(),
      body: JSON.stringify({ action: "complete-task", taskId }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: String(err) };
  }
});

// ── App lifecycle ───────────────────────────────────────────────

app.whenReady().then(() => {
  createSplash();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createSplash();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
