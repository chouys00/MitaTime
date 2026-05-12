import { app, globalShortcut, BrowserWindow } from 'electron';
import { timerService } from './timer';

const SHORTCUTS = {
  START_REST: 'CommandOrControl+Alt+Right',
  START_FOCUS: 'CommandOrControl+Alt+Left',
  TOGGLE_WINDOW: 'CommandOrControl+Alt+Up',
  RESET: 'CommandOrControl+Alt+Down',
  PAUSE: 'CommandOrControl+Alt+P',
} as const;

/**
 * 將主視窗喚到前景：還原最小化、必要時 show，並盡力從其它應用程式之下取回焦點。
 * 與 Cmd/Ctrl+Alt+Up 一致：僅檢查 isVisible 不夠，被壓在底下的視窗仍 isVisible===true。
 */
function focusMainWindow(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) {
    win.restore();
  }
  if (!win.isVisible()) {
    win.show();
  }
  app.focus({ steal: true });
  win.focus();
}

export function registerGlobalShortcuts(getMainWindow: () => BrowserWindow | null): void {
  unregisterGlobalShortcuts();

  // ① 開始休息
  globalShortcut.register(SHORTCUTS.START_REST, () => {
    focusMainWindow(getMainWindow);
    void timerService.start('rest');
  });

  // ② 開始專注
  globalShortcut.register(SHORTCUTS.START_FOCUS, () => {
    focusMainWindow(getMainWindow);
    void timerService.start('focus');
  });

  // ③ 展開 / 縮小工具
  globalShortcut.register(SHORTCUTS.TOGGLE_WINDOW, () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      focusMainWindow(getMainWindow);
    }
  });

  // ④ 重置
  globalShortcut.register(SHORTCUTS.RESET, () => {
    focusMainWindow(getMainWindow);
    timerService.reset();
  });

  // ⑤ 暫停（同時支援切換暫停/恢復）
  globalShortcut.register(SHORTCUTS.PAUSE, () => {
    focusMainWindow(getMainWindow);
    void timerService.toggleRunning('focus');
  });
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
