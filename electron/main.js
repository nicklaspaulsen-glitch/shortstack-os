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

const APP_URL = "https://shortstack-os.vercel.app";
const LICENSE_FILE = path.join(app.getPath("userData"), "license.json");
const SETTINGS_FILE = path.join(app.getPath("userData"), "app-settings.json");
const SESSION_FILE = path.join(app.getPath("userData"), "agent-session.json");
const APP_VERSION = app.getVersion() || "1.0.0";

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

async function checkForUpdates() {
  try {
    const { net } = require("electron");
    const res = await net.fetch(APP_URL + "/api/app/version");
    const data = await res.json();

    if (data.version && data.version !== APP_VERSION) {
      updateAvailable = data;

      // Show simple notification — features auto-update via web
      const result = await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "New Features Available",
        message: `ShortStack OS v${data.version}`,
        detail: `${data.release_notes || "New features available."}\n\nThe app will refresh to load the latest version.`,
        buttons: ["Refresh Now", "Later"],
        defaultId: 0,
        cancelId: 1,
      });

      if (result.response === 0 && mainWindow && !mainWindow.isDestroyed()) {
        // Just clear cache and reload — features are on the web
        await mainWindow.webContents.session.clearCache();
        mainWindow.webContents.reloadIgnoringCache();
      }
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

  // Show progress in-app
  mainWindow.webContents.executeJavaScript(`
    (function() {
      if (document.getElementById('ss-update-banner')) document.getElementById('ss-update-banner').remove();
      const banner = document.createElement('div');
      banner.id = 'ss-update-banner';
      banner.style.cssText = 'position:fixed;top:36px;left:0;right:0;z-index:99999;background:#0c1017;border-bottom:1px solid #1e2a3a;color:#C9A84C;padding:8px 16px;display:flex;align-items:center;gap:12px;font-family:Inter,system-ui,sans-serif;font-size:11px;-webkit-app-region:no-drag;';
      banner.innerHTML = '<div style="flex:1;"><div style="color:#94a3b8;margin-bottom:4px;">Downloading v${version}...</div><div style="width:100%;height:4px;background:#1e2a3a;border-radius:2px;overflow:hidden;"><div id="ss-update-progress" style="width:0%;height:100%;background:#C9A84C;border-radius:2px;transition:width 0.3s;"></div></div></div>';
      document.body.prepend(banner);
    })();
  `);

  const tmpPath = path.join(app.getPath("temp"), "ShortStack-OS-Update.exe");
  const file = fs.createWriteStream(tmpPath);

  function doDownload(downloadUrl) {
    const protocol = downloadUrl.startsWith("https") ? https : http;
    protocol.get(downloadUrl, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        doDownload(response.headers.location);
        return;
      }

      const total = parseInt(response.headers["content-length"] || "0", 10);
      let downloaded = 0;

      response.on("data", (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (total > 0 && mainWindow && !mainWindow.isDestroyed()) {
          const pct = Math.round((downloaded / total) * 100);
          mainWindow.webContents.executeJavaScript(
            `document.getElementById('ss-update-progress')&&(document.getElementById('ss-update-progress').style.width='${pct}%')`
          ).catch(() => {});
        }
      });

      response.on("end", () => {
        file.end();
        // Install
        if (mainWindow && !mainWindow.isDestroyed()) {
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
        }
      });

      response.on("error", () => {
        file.end();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.executeJavaScript(`
            document.getElementById('ss-update-banner')&&(document.getElementById('ss-update-banner').innerHTML='<span style="color:#f43f5e;">Download failed. <a href="${url}" style="color:#C9A84C;cursor:pointer;" onclick="require(\\'electron\\').shell.openExternal(\\'${url}\\')">Download manually</a></span>');
          `).catch(() => {});
        }
      });
    });
  }

  doDownload(url);
}

// ── Splash / License screen ─────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480, height: 600, frame: false, resizable: false,
    backgroundColor: "#06080c",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const license = getLicense();
  const isActive = license?.activated && !isTrialExpired(license);

  const commonCSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #06080c; color: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
    .gold { color: #C9A84C; }
    .muted { color: #64748b; }
    .danger { color: #f43f5e; }
    .success { color: #10b981; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes glow { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    .spinner { width: 36px; height: 36px; border: 2px solid #1e2a3a; border-top: 2px solid #C9A84C; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px; }
    .fade { animation: fadeUp 0.5s ease-out forwards; opacity: 0; }
    .delay-1 { animation-delay: 0.1s; }
    .delay-2 { animation-delay: 0.2s; }
    .delay-3 { animation-delay: 0.3s; }
    .delay-4 { animation-delay: 0.4s; }
    .delay-5 { animation-delay: 0.5s; }
    .delay-6 { animation-delay: 0.6s; }
    input { width: 100%; background: #0c1017; border: 1px solid #1e2a3a; border-radius: 10px; padding: 11px 14px; color: white; font-size: 13px; outline: none; margin-bottom: 10px; box-sizing: border-box; transition: border-color 0.2s; }
    input:focus { border-color: rgba(201,168,76,0.5); box-shadow: 0 0 0 3px rgba(201,168,76,0.06); }
    input::placeholder { color: #3a4a5e; }
    .btn { width: 100%; border: none; border-radius: 10px; padding: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-gold { background: linear-gradient(135deg, #C9A84C, #D4B85A, #A8893D); color: #0b0d12; }
    .btn-gold:hover { box-shadow: 0 0 20px rgba(201,168,76,0.25); transform: translateY(-1px); }
    .btn-ghost { background: rgba(255,255,255,0.03); color: #94a3b8; border: 1px solid #1e2a3a; }
    .btn-ghost:hover { border-color: #2e3e52; color: #e2e8f0; background: rgba(255,255,255,0.05); }
    .divider { display: flex; align-items: center; gap: 12px; margin: 14px 0; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #1e2a3a; }
    .divider span { font-size: 9px; color: #3a4a5e; text-transform: uppercase; letter-spacing: 1px; }
    .features { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; }
    .feature { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 10px; text-align: center; }
    .feature .icon { font-size: 14px; margin-bottom: 3px; }
    .feature .label { font-size: 9px; color: #64748b; }
    a { color: #C9A84C; text-decoration: none; }
    a:hover { text-decoration: underline; }
  `;

  const html = isActive ? `
    <style>${commonCSS}
      .glow-bg { position:fixed; top:-100px; left:50%; transform:translateX(-50%); width:400px; height:300px; background:radial-gradient(ellipse,rgba(201,168,76,0.06) 0%,transparent 70%); pointer-events:none; animation:glow 3s ease-in-out infinite; }
    </style>
    <body style="-webkit-app-region:drag;">
      <div class="glow-bg"></div>
      <div class="fade" style="font-size:28px;font-weight:800;letter-spacing:-0.5px;" class="gold">ShortStack OS</div>
      <div class="fade delay-1" style="font-size:9px;letter-spacing:4px;margin:6px 0 32px;color:#64748b;">AGENCY OPERATING SYSTEM</div>
      <div class="spinner"></div>
      <div class="fade delay-2 success" style="font-size:12px;font-weight:600;">License Active</div>
      <div class="fade delay-3" style="font-size:11px;color:#C9A84C;margin-top:4px;font-weight:500;">${license.tier}</div>
      <div class="fade delay-4 muted" style="font-size:10px;margin-top:6px;">
        ${license.type === "trial" ? "Trial ends " + new Date(license.trial_ends).toLocaleDateString() : "Full License"}
      </div>
      <div class="fade delay-5 muted" style="font-size:9px;margin-top:16px;">v${APP_VERSION}</div>
      <script>setTimeout(()=>require('electron').ipcRenderer.send('launch-app'),1200)</script>
    </body>` : `
    <style>${commonCSS}
      .glow-bg { position:fixed; top:-80px; left:50%; transform:translateX(-50%); width:500px; height:350px; background:radial-gradient(ellipse,rgba(201,168,76,0.05) 0%,transparent 70%); pointer-events:none; animation:glow 4s ease-in-out infinite; }
      .logo-ring { width:56px; height:56px; border-radius:50%; border:2px solid rgba(201,168,76,0.2); display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
      .logo-ring .inner { width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05)); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:800; color:#C9A84C; }
      .tab-row { display:flex; gap:4px; margin-bottom:16px; background:rgba(255,255,255,0.02); border-radius:10px; padding:3px; border:1px solid #1e2a3a; }
      .tab { flex:1; padding:8px; text-align:center; font-size:11px; font-weight:600; border-radius:8px; cursor:pointer; transition:all 0.2s; color:#64748b; }
      .tab.active { background:rgba(201,168,76,0.1); color:#C9A84C; }
      .tab:not(.active):hover { color:#94a3b8; }
      .panel { display:none; }
      .panel.active { display:block; }
    </style>
    <body>
      <div class="glow-bg"></div>

      <div style="-webkit-app-region:drag;text-align:center;margin-bottom:16px;">
        <div class="fade logo-ring" style="margin:0 auto 14px;">
          <div class="inner">SS</div>
        </div>
        <div class="fade delay-1" style="font-size:22px;font-weight:800;color:#C9A84C;letter-spacing:-0.5px;">ShortStack OS</div>
        <div class="fade delay-2" style="font-size:10px;color:#3a4a5e;margin-top:4px;letter-spacing:1px;">YOUR AI-POWERED AGENCY</div>
        ${isTrialExpired(license) ? '<div class="fade delay-2 danger" style="font-size:11px;margin-top:10px;">Your trial has expired. Activate a license to continue.</div>' : ''}
      </div>

      <div class="fade delay-3" style="-webkit-app-region:no-drag;width:100%;padding:0 32px;">
        <div class="tab-row">
          <div class="tab active" onclick="switchTab('license')">License Key</div>
          <div class="tab" onclick="switchTab('trial')">Free Trial</div>
        </div>

        <!-- License Panel -->
        <div class="panel active" id="panel-license">
          <input id="key" placeholder="Enter your license key">
          <input id="email-license" type="email" placeholder="Email address">
          <div id="err" class="danger" style="font-size:10px;margin-bottom:8px;display:none;"></div>
          <button class="btn btn-gold" onclick="activate()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>
            Activate License
          </button>
        </div>

        <!-- Trial Panel -->
        <div class="panel" id="panel-trial">
          <input id="email-trial" type="email" placeholder="Enter your email to start">
          <div id="err2" class="danger" style="font-size:10px;margin-bottom:8px;display:none;"></div>
          <button class="btn btn-gold" onclick="trial()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Start 14-Day Free Trial
          </button>
          <div style="text-align:center;margin-top:10px;font-size:10px;color:#3a4a5e;">No credit card required</div>
        </div>

        <div class="divider"><span>or</span></div>

        <button class="btn btn-ghost" onclick="require('electron').shell.openExternal('https://shortstack.work/pricing')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
          Create Account at shortstack.work
        </button>

        <!-- Feature highlights -->
        <div class="features fade delay-5">
          <div class="feature"><div class="icon">&#x26A1;</div><div class="label">14 AI Tools</div></div>
          <div class="feature"><div class="icon">&#x1F4C1;</div><div class="label">File Management</div></div>
          <div class="feature"><div class="icon">&#x1F3A8;</div><div class="label">Brand Kits</div></div>
          <div class="feature"><div class="icon">&#x1F4F1;</div><div class="label">Campaigns</div></div>
        </div>
      </div>

      <div class="fade delay-6" style="position:absolute;bottom:12px;font-size:9px;color:#1e2a3a;">v${APP_VERSION}</div>

      <script>
        const{ipcRenderer,shell}=require('electron');
        function switchTab(tab){
          document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
          document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
          document.querySelector('.tab-row').children[tab==='license'?0:1].classList.add('active');
          document.getElementById('panel-'+tab).classList.add('active');
          clearErrs();
        }
        function clearErrs(){document.getElementById('err').style.display='none';document.getElementById('err2').style.display='none';}
        function activate(){
          const k=document.getElementById('key').value.trim(),e=document.getElementById('email-license').value.trim();
          if(!k){showErr('err','Enter your license key');return;}
          ipcRenderer.send('activate-license',{key:k,email:e||''});
        }
        function trial(){
          const e=document.getElementById('email-trial').value.trim();
          if(!e){showErr('err2','Enter your email address');return;}
          ipcRenderer.send('start-trial',{email:e});
        }
        function showErr(id,m){const el=document.getElementById(id);el.style.display='block';el.textContent=m;}
        ipcRenderer.on('activation-error',(ev,m)=>showErr('err',m));
      </script>
    </body>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head>${html}</html>`)}`);
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
