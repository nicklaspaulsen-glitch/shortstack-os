const { app, BrowserWindow, Menu, Tray, nativeImage } = require("electron");
const path = require("path");

let mainWindow;
let tray;

const APP_URL = "https://shortstack-os.vercel.app";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: "ShortStack OS",
    icon: path.join(__dirname, "../public/icons/shortstack-logo.png"),
    backgroundColor: "#0a0a0a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0a0a0a",
      symbolColor: "#C9A84C",
      height: 36,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Remove default menu
  Menu.setApplicationMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  // Create system tray
  try {
    const icon = nativeImage.createFromPath(
      path.join(__dirname, "../public/icons/shortstack-logo.png")
    );
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip("ShortStack OS");
    tray.on("click", () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    });
  } catch {
    // Tray icon failed silently
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
