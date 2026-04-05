const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let splashWindow;
let tray;

const APP_URL = "https://shortstack-os.vercel.app";
const LICENSE_FILE = path.join(app.getPath("userData"), "license.json");
const APP_VERSION = app.getVersion() || "1.0.0";

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

// ── Splash / License screen ─────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 440, height: 540, frame: false, resizable: false,
    backgroundColor: "#06080c",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const license = getLicense();
  const isActive = license?.activated && !isTrialExpired(license);

  const commonCSS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #06080c; color: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; }
    .gold { color: #C9A84C; }
    .muted { color: #64748b; }
    .danger { color: #f43f5e; }
    .success { color: #10b981; }
    input { width: 100%; background: #0c1017; border: 1px solid #1e2a3a; border-radius: 8px; padding: 10px 14px; color: white; font-size: 13px; outline: none; margin-bottom: 12px; box-sizing: border-box; transition: border-color 0.2s; }
    input:focus { border-color: rgba(201,168,76,0.4); }
    .btn-gold { width: 100%; background: linear-gradient(135deg, #C9A84C, #D4B85A, #A8893D); color: black; border: none; border-radius: 8px; padding: 11px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn-gold:hover { box-shadow: 0 0 15px rgba(201,168,76,0.2); }
    .btn-ghost { width: 100%; background: #0c1017; color: #64748b; border: 1px solid #1e2a3a; border-radius: 8px; padding: 10px; font-size: 12px; cursor: pointer; transition: all 0.2s; }
    .btn-ghost:hover { border-color: #2a3a4e; color: #94a3b8; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
    .spinner { width: 40px; height: 40px; border: 2px solid #1e2a3a; border-top: 2px solid #C9A84C; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 20px; }
  `;

  const html = isActive ? `
    <style>${commonCSS}</style>
    <body style="-webkit-app-region:drag;">
      <div style="font-size:24px;font-weight:800;" class="gold">ShortStack OS</div>
      <div style="font-size:9px;letter-spacing:3px;margin:4px 0 30px;" class="muted">AGENCY OPERATING SYSTEM</div>
      <div class="spinner"></div>
      <div class="success" style="font-size:12px;">License Active &mdash; ${license.tier}</div>
      <div class="muted" style="font-size:10px;margin-top:6px;">
        ${license.type === "trial" ? "Trial ends " + new Date(license.trial_ends).toLocaleDateString() : "Full License"}
      </div>
      <div class="muted" style="font-size:9px;margin-top:12px;">v${APP_VERSION}</div>
      <script>setTimeout(()=>require('electron').ipcRenderer.send('launch-app'),1200)</script>
    </body>` : `
    <style>${commonCSS}</style>
    <body>
      <div style="-webkit-app-region:drag;text-align:center;margin-bottom:24px;">
        <div style="font-size:24px;font-weight:800;" class="gold">ShortStack OS</div>
        <div style="font-size:9px;letter-spacing:3px;margin-top:4px;" class="muted">AGENCY OPERATING SYSTEM</div>
        <div style="width:40px;height:1px;background:#C9A84C;margin:16px auto;"></div>
        ${isTrialExpired(license) ? '<div class="danger" style="font-size:11px;margin-bottom:8px;">Trial expired. Please activate a license.</div>' : ''}
      </div>
      <div style="-webkit-app-region:no-drag;width:100%;padding:0 36px;">
        <div class="muted" style="font-size:10px;margin-bottom:3px;">License Key</div>
        <input id="key" placeholder="XXXX-XXXX-XXXX-XXXX">
        <div class="muted" style="font-size:10px;margin-bottom:3px;">Email</div>
        <input id="email" type="email" placeholder="you@company.com">
        <div id="err" class="danger" style="font-size:10px;margin-bottom:8px;display:none;"></div>
        <button class="btn-gold" onclick="activate()">Activate License</button>
        <div style="height:8px;"></div>
        <button class="btn-ghost" onclick="trial()">Start 14-Day Free Trial</button>
        <div style="text-align:center;margin-top:12px;font-size:10px;" class="muted">
          No license? <a href="#" onclick="require('electron').shell.openExternal('https://shortstack.work')" class="gold" style="text-decoration:none;">Get one at shortstack.work</a>
        </div>
        <div style="text-align:center;margin-top:8px;font-size:9px;color:#2a3a4e;">
          Starter $997/mo &middot; Growth $2,497/mo &middot; Enterprise $4,997/mo
        </div>
      </div>
      <script>
        const{ipcRenderer}=require('electron');
        function activate(){
          const k=document.getElementById('key').value.trim(),e=document.getElementById('email').value.trim();
          if(!k||!e){showErr('Enter license key and email');return;}
          ipcRenderer.send('activate-license',{key:k,email:e});
        }
        function trial(){
          const e=document.getElementById('email').value.trim();
          if(!e){showErr('Enter your email');return;}
          ipcRenderer.send('start-trial',{email:e});
        }
        function showErr(m){const el=document.getElementById('err');el.style.display='block';el.textContent=m;}
        ipcRenderer.on('activation-error',(ev,m)=>showErr(m));
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
    titleBarOverlay: { color: "#06080c", symbolColor: "#C9A84C", height: 32 },
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

  mainWindow.loadURL(APP_URL + "/login");
  mainWindow.on("closed", () => { mainWindow = null; });

  // Application menu (none — clean look)
  Menu.setApplicationMenu(null);

  // System tray
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "../public/icons/shortstack-logo.png"));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip("ShortStack OS");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open ShortStack OS", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
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
