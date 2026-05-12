import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './ipc-handlers';
import { createTray, destroyTray } from './tray';
import { registerGlobalShortcuts, unregisterGlobalShortcuts } from './shortcuts';
import { settingsStore } from './settings-store';

interface AppFlags {
  isQuitting: boolean;
}

const flags = app as unknown as AppFlags;
flags.isQuitting = false;

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_URL = 'http://localhost:5173';
const APP_USER_MODEL_ID = 'com.mitatime.app';

// Windows：設定 AppUserModelID，否則工作列釘選會抓父行程（electron.exe）的圖示，
// 並導致同 app 多視窗無法正確分組。必須在所有視窗建立前呼叫。
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

function resolveAppIcon(): string {
  // Windows 在工作列與 .exe 內嵌圖示使用 .ico（多解析度）較穩定；
  // macOS / Linux 直接使用 PNG。
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return path.join(__dirname, '../../resources', iconFile);
}

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 400,
    height: 292,
    minWidth: 400,
    minHeight: 268,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    // 透明無框視窗在 Windows 上，系統陰影仍依矩形繪製，與 CSS 圓角疊加會像「外緣凸出一圈」
    hasShadow: process.platform !== 'win32',
    skipTaskbar: false,
    icon: resolveAppIcon(),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // 內容安全政策（CSP）
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' http://localhost:5173 ws://localhost:5173; " +
        "script-src 'self' 'unsafe-inline' http://localhost:5173; " +
        "style-src 'self' 'unsafe-inline' http://localhost:5173; " +
        "img-src 'self' data: http://localhost:5173; " +
        "font-src 'self' data: http://localhost:5173; " +
        "connect-src 'self' http://localhost:5173 ws://localhost:5173;"
      : "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "font-src 'self' data:; " +
        "connect-src 'self';";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // 防止導覽劫持
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const allowed = isDev ? parsed.origin === DEV_SERVER_URL : parsed.protocol === 'file:';
      if (!allowed) {
        event.preventDefault();
        console.warn(`Blocked navigation to: ${url}`);
      }
    } catch {
      event.preventDefault();
    }
  });

  // 阻擋新視窗
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const externalUrl = new URL(url);
      if (externalUrl.protocol === 'https:') {
        void shell.openExternal(externalUrl.toString());
      }
    } catch {
      // ignore
    }
    return { action: 'deny' };
  });

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[MitaTime] preload-error', preloadPath, error);
  });

  // 載入內容
  if (isDev) {
    void win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 預備好再顯示
  win.once('ready-to-show', () => {
    win.show();
  });

  // 攔截關閉：隱藏到 Tray，計時器於背景持續運作
  win.on('close', (event) => {
    if (!flags.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  return win;
}

// 確保只有單一實例；未取得鎖則不重複註冊事件與啟動邏輯
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await settingsStore.load();

    registerIpcHandlers(getMainWindow);

    mainWindow = createMainWindow();

    createTray(getMainWindow);

    registerGlobalShortcuts(getMainWindow);

    app.on('activate', () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        mainWindow = createMainWindow();
      } else {
        mainWindow.show();
      }
    });
  });

  // 全平台保持背景運行：close 已在 BrowserWindow 攔截為 hide()，
  // 因此除非使用者透過 Tray「退出」（將 isQuitting 設為 true 並 app.quit()），
  // 否則我們不主動退出。
  app.on('window-all-closed', () => {
    if (flags.isQuitting && process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    flags.isQuitting = true;
  });

  app.on('will-quit', () => {
    unregisterGlobalShortcuts();
    destroyTray();
  });

  // 安全：阻擋 <webview> 標籤
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
  });
}
