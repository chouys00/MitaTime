import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';

let trayInstance: Tray | null = null;

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  const iconPath = path.join(__dirname, '../../resources/tray-cat-icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  } else {
    icon = icon.resize({ width: 16, height: 16 });
  }

  const tray = new Tray(icon);
  tray.setToolTip('MitaTime — 番茄鐘');

  const showWindow = () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      if (!win.isVisible()) win.show();
      win.focus();
    }
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '展開工具',
      click: showWindow,
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // 標記真正退出，繞過 close 攔截
        (app as unknown as { isQuitting: boolean }).isQuitting = true;
        app.quit();
      },
    },
  ]);

  // 左鍵點擊：展開視窗
  tray.on('click', showWindow);
  // macOS 上雙擊也展開
  tray.on('double-click', showWindow);
  // 右鍵：顯示選單（Windows 上 click 不會自動顯示，這裡明確指定）
  tray.on('right-click', () => {
    tray.popUpContextMenu(contextMenu);
  });

  // 將選單同時設給系統，讓某些平台預設右鍵行為仍可用
  tray.setContextMenu(contextMenu);

  trayInstance = tray;
  return tray;
}

export function destroyTray(): void {
  if (trayInstance && !trayInstance.isDestroyed()) {
    trayInstance.destroy();
  }
  trayInstance = null;
}
