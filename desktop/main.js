import { app, BrowserWindow, Menu, shell } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

let mainWindow = null;
let localServer = null;

function createWindow(url) {
  mainWindow = new BrowserWindow({
    title: "禅",
    width: 920,
    height: 720,
    minWidth: 200,
    minHeight: 200,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#141210",
    icon: path.join(projectRoot, "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith("https://github.com/FNOSP/cyber-zen")) {
      void shell.openExternal(targetUrl);
    }
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadURL(url);
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    const dataDir = path.join(app.getPath("userData"), "data");
    process.env.DATA_DIR = dataDir;
    const { startServer } = await import(pathToFileURL(path.join(projectRoot, "server.js")).href);
    const started = await startServer({ port: 0, host: "127.0.0.1" });
    localServer = started.server;
    createWindow(`http://127.0.0.1:${started.port}/`);
  }).catch((error) => {
    console.error(error);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && localServer) {
      const address = localServer.address();
      if (typeof address === "object" && address) {
        createWindow(`http://127.0.0.1:${address.port}/`);
      }
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", () => {
    localServer?.close();
  });
}
