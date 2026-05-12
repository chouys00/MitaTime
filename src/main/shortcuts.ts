import { globalShortcut, BrowserWindow } from 'electron';
import { timerService } from './timer';

const SHORTCUTS = {
  START_REST: 'CommandOrControl+Alt+Right',
  START_FOCUS: 'CommandOrControl+Alt+Left',
  TOGGLE_WINDOW: 'CommandOrControl+Alt+Up',
  RESET: 'CommandOrControl+Alt+Down',
  PAUSE: 'CommandOrControl+Alt+P',
} as const;

/**
 * 確保視窗顯示後再執行動作。
 * 對應需求：①、②、④、⑤ 觸發時若視窗隱藏需先 show，然後再透過 IPC（state 變化）通知 Renderer。
 */
function ensureVisible(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) {
    win.show();
  }
}

export function registerGlobalShortcuts(getMainWindow: () => BrowserWindow | null): void {
  unregisterGlobalShortcuts();

  // ① 開始休息
  globalShortcut.register(SHORTCUTS.START_REST, () => {
    ensureVisible(getMainWindow);
    void timerService.start('rest');
  });

  // ② 開始專注
  globalShortcut.register(SHORTCUTS.START_FOCUS, () => {
    ensureVisible(getMainWindow);
    void timerService.start('focus');
  });

  // ③ 展開 / 縮小工具
  globalShortcut.register(SHORTCUTS.TOGGLE_WINDOW, () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  // ④ 重置
  globalShortcut.register(SHORTCUTS.RESET, () => {
    ensureVisible(getMainWindow);
    timerService.reset();
  });

  // ⑤ 暫停（同時支援切換暫停/恢復）
  globalShortcut.register(SHORTCUTS.PAUSE, () => {
    ensureVisible(getMainWindow);
    void timerService.toggleRunning('focus');
  });
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
