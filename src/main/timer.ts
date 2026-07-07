import { BrowserWindow } from 'electron';
import { EventEmitter } from 'node:events';
import type { TimerState } from '../shared/types';
import { IPC, TICK_INTERVAL_MS } from '../shared/constants';
import { TimerEngine, type ActiveTimerMode } from '../shared/timer-engine';
import { settingsStore } from './settings-store';
import { bringBrowserWindowToForeground } from './window-focus';

/**
 * Main process 計時服務：包裝共用的 TimerEngine（純計時核心），
 * 負責 Electron 側的職責 — IPC 廣播、完成時帶視窗到前景與閃爍提醒。
 */
class TimerService extends EventEmitter {
  private readonly engine = new TimerEngine({
    tickIntervalMs: TICK_INTERVAL_MS,
    onTick: () => this.broadcast(),
    onStateChanged: (state) => {
      this.forEachAliveWindow((win) =>
        win.webContents.send(IPC.TIMER_STATE_CHANGED, state),
      );
      this.emit('state-changed', state);
    },
    onCompleted: (mode) => this.handleCompleted(mode),
  });

  /** 取得當前狀態 */
  getState(): TimerState {
    return this.engine.getState();
  }

  /** 啟動指定模式的倒數 */
  start(mode: ActiveTimerMode): TimerState {
    const settings = settingsStore.get();
    const seconds = mode === 'focus' ? settings.focusSeconds : settings.restSeconds;
    return this.engine.start(mode, seconds * 1000);
  }

  /** 暫停 */
  pause(): TimerState {
    return this.engine.pause();
  }

  /** 從暫停中恢復 */
  resume(): TimerState {
    return this.engine.resume();
  }

  /** 切換 暫停 / 恢復；若處於 idle，使用預設模式啟動 */
  toggleRunning(defaultMode: ActiveTimerMode = 'focus'): TimerState {
    const { mode, status } = this.engine.getState();
    if (mode === 'idle') {
      return this.start(defaultMode);
    }
    if (status === 'paused') {
      return this.resume();
    }
    return this.pause();
  }

  /**
   * 使用者重置：idle 不變；專注／休息則載入該模式設定的完整時長並停在 paused（不倒數）。
   */
  reset(): TimerState {
    const { mode } = this.engine.getState();
    if (mode === 'idle') {
      return this.engine.reset(0);
    }
    const settings = settingsStore.get();
    const seconds = mode === 'focus' ? settings.focusSeconds : settings.restSeconds;
    return this.engine.reset(seconds * 1000);
  }

  /** 使用者關閉「倒數完成」提示後回到 idle */
  dismissCompletion(): TimerState {
    return this.engine.dismissCompletion();
  }

  /** 廣播當前狀態到所有渲染進程 */
  broadcast(): void {
    const state = this.getState();
    this.forEachAliveWindow((win) => win.webContents.send(IPC.TIMER_TICK, state));
  }

  // ─────────────────────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────────────────────

  private handleCompleted(mode: ActiveTimerMode): void {
    // 關閉到 Tray／最小化時仍須帶出主視窗（不再顯示系統右下角通知）
    this.bringWindowsToForeground();
    this.flashWindowAttention();
    this.forEachAliveWindow((win) =>
      win.webContents.send(IPC.TIMER_COMPLETED, { mode }),
    );
  }

  /** 對所有尚未銷毀的視窗執行回呼 */
  private forEachAliveWindow(cb: (win: BrowserWindow) => void): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) cb(win);
    }
  }

  /** 還原、顯示並聚焦所有應用程式視窗（含關閉到 Tray 的隱藏狀態） */
  private bringWindowsToForeground(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      bringBrowserWindowToForeground(win);
    }
  }

  private flashWindowAttention(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      win.flashFrame(true);
      let done = false;
      const stopFlash = () => {
        if (done) return;
        done = true;
        win.removeListener('focus', stopFlash);
        if (!win.isDestroyed()) {
          win.flashFrame(false);
        }
      };
      win.on('focus', stopFlash);
      setTimeout(stopFlash, 6000);
    }
  }
}

export const timerService = new TimerService();
