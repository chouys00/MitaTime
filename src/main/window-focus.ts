import { app, BrowserWindow } from 'electron';

/**
 * 在 Windows 上，自 setInterval 等非使用者互動路徑觸發時，單靠 focus / steal 常無法搶到前景；
 * 短暫 always-on-top + moveTop 可提高將視窗「頂到前面」的成功率。
 */
function raiseWindowAboveOthers(win: BrowserWindow): void {
  try {
    win.moveTop();
  } catch {
    // 極少數情境下可能拋錯，略過即可
  }
  if (process.platform === 'win32') {
    win.setAlwaysOnTop(true);
    setImmediate(() => {
      if (!win.isDestroyed()) {
        win.setAlwaysOnTop(false);
      }
    });
  }
}

/**
 * 還原、顯示並盡力將單一視窗帶到前景（含被其它應用壓在底下、isVisible 仍為 true 時）。
 */
export function bringBrowserWindowToForeground(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  raiseWindowAboveOthers(win);
  app.focus({ steal: true });
  win.focus();
}
