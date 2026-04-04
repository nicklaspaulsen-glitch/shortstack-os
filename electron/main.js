const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;
let splashWindow;
let tray;

const APP_URL = "https://shortstack-os.vercel.app";
const LICENSE_FILE = path.join(app.getPath("userData"), "license.json");

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

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480, height: 580, frame: false, resizable: false,
    backgroundColor: "#0a0a0a",
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });

  const license = getLicense();
  const isActive = license?.activated && !isTrialExpired(license);

  const html = isActive ? `
    <body style="font-family:Segoe UI,sans-serif;background:#0a0a0a;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;-webkit-app-region:drag;">
      <div style="font-size:28px;font-weight:800;color:#C9A84C;">ShortStack OS</div>
      <div style="font-size:10px;color:#888;letter-spacing:2px;margin:4px 0 30px;">AGENCY OPERATING SYSTEM</div>
      <div style="width:50px;height:50px;border:3px solid #222;border-top:3px solid #C9A84C;border-radius:50%;animation:spin 1s linear infinite;margin-bottom:20px;"></div>
      <div style="color:#22c55e;font-size:13px;">License Active — ${license.tier}</div>
      <div style="color:#666;font-size:11px;margin-top:8px;">${license.type === "trial" ? "Trial ends " + new Date(license.trial_ends).toLocaleDateString() : "Full License"}</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      <script>setTimeout(()=>require('electron').ipcRenderer.send('launch-app'),1500)</script>
    </body>` : `
    <body style="font-family:Segoe UI,sans-serif;background:#0a0a0a;color:white;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:40px;">
      <div style="-webkit-app-region:drag;text-align:center;margin-bottom:30px;">
        <div style="font-size:28px;font-weight:800;color:#C9A84C;">ShortStack OS</div>
        <div style="font-size:10px;color:#888;letter-spacing:2px;margin-top:4px;">AGENCY OPERATING SYSTEM</div>
        <div style="width:50px;height:2px;background:#C9A84C;margin:20px auto;"></div>
        ${isTrialExpired(license) ? '<div style="color:#ef4444;font-size:12px;margin-bottom:10px;">Your trial has expired. Please activate a license.</div>' : ''}
      </div>
      <div style="-webkit-app-region:no-drag;width:100%;">
        <div style="font-size:11px;color:#888;margin-bottom:4px;">License Key</div>
        <input id="key" placeholder="XXXX-XXXX-XXXX-XXXX" style="width:100%;background:#111;border:1px solid #333;border-radius:8px;padding:11px 14px;color:white;font-size:13px;outline:none;margin-bottom:14px;box-sizing:border-box;">
        <div style="font-size:11px;color:#888;margin-bottom:4px;">Email</div>
        <input id="email" type="email" placeholder="you@company.com" style="width:100%;background:#111;border:1px solid #333;border-radius:8px;padding:11px 14px;color:white;font-size:13px;outline:none;margin-bottom:14px;box-sizing:border-box;">
        <div id="err" style="color:#ef4444;font-size:11px;margin-bottom:10px;display:none;"></div>
        <button onclick="activate()" style="width:100%;background:#C9A84C;color:black;border:none;border-radius:8px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;">Activate License</button>
        <button onclick="trial()" style="width:100%;background:#1a1a1a;color:#888;border:1px solid #333;border-radius:8px;padding:10px;font-size:12px;cursor:pointer;">Start 14-Day Free Trial</button>
        <div style="text-align:center;margin-top:14px;font-size:11px;color:#666;">
          No license? <a href="#" onclick="require('electron').shell.openExternal('https://shortstack.work')" style="color:#C9A84C;text-decoration:none;">Get one at shortstack.work</a>
        </div>
        <div style="text-align:center;margin-top:10px;font-size:10px;color:#444;">
          Starter $997/mo · Growth $2,497/mo · Enterprise $4,997/mo
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

function createMainWindow() {
  const license = getLicense();

  mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 700,
    title: "ShortStack OS",
    icon: path.join(__dirname, "../public/icons/shortstack-logo.png"),
    backgroundColor: "#0a0a0a",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#0a0a0a", symbolColor: "#C9A84C", height: 36 },
    autoHideMenuBar: true, show: false,
  });

  mainWindow.loadURL(APP_URL + "/login");
  mainWindow.once("ready-to-show", () => { if (splashWindow) splashWindow.close(); mainWindow.show(); });
  mainWindow.on("closed", () => { mainWindow = null; });

  Menu.setApplicationMenu(null);

  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, "../public/icons/shortstack-logo.png"));
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip("ShortStack OS");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Open ShortStack OS", click: () => mainWindow?.show() },
      { type: "separator" },
      { label: `${license?.tier || "Trial"} Plan`, enabled: false },
      { label: "Quit", click: () => app.quit() },
    ]));
    tray.on("double-click", () => mainWindow?.show());
  } catch {}
}

ipcMain.on("activate-license", (event, { key, email }) => {
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key)) {
    event.reply("activation-error", "Invalid key format: XXXX-XXXX-XXXX-XXXX");
    return;
  }
  let tier = "Growth";
  if (key.toUpperCase().startsWith("ENT")) tier = "Enterprise";
  else if (key.toUpperCase().startsWith("STR")) tier = "Starter";
  saveLicense({ key, email, tier, activated: true, activated_at: new Date().toISOString(), type: "license" });
  if (splashWindow) splashWindow.close();
  createSplash();
});

ipcMain.on("start-trial", (event, { email }) => {
  const ends = new Date(); ends.setDate(ends.getDate() + 14);
  saveLicense({ email, tier: "Growth", activated: true, activated_at: new Date().toISOString(), trial_ends: ends.toISOString(), type: "trial" });
  if (splashWindow) splashWindow.close();
  createSplash();
});

ipcMain.on("launch-app", () => createMainWindow());

app.whenReady().then(() => { createSplash(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createSplash(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
