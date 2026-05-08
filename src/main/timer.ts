import { app, BrowserWindow } from 'electron';
import { EventEmitter } from 'node:events';
import type { TimerMode, TimerState } from '../shared/types';
import { IPC, TICK_INTERVAL_MS } from '../shared/constants';
import { settingsStore } from './settings-store';

/**
 * 精準計時器
 *
 * 採用「目標時間戳 (Date.now() + duration)」+ 高頻比對的方式，
 * 而非單純的 setInterval 倒數，避免系統休眠造成累計誤差。
 */
class TimerService extends EventEmitter {
  private mode: TimerMode = 'idle';
  private totalMs = 0;
  /** 預定結束的時間戳（毫秒） */
  private targetTimestamp = 0;
  /** 暫停時的剩餘毫秒 */
  private pausedRemainingMs = 0;
  private isRunning = false;
  private isPaused = false;
  private tickHandle: NodeJS.Timeout | null = null;

  /** 取得當前狀態 */
  getState(): TimerState {
    return {
      mode: this.mode,
      totalMs: this.totalMs,
      remainingMs: this.computeRemainingMs(),
      isRunning: this.isRunning,
      isPaused: this.isPaused,
    };
  }

  /** 啟動指定模式的倒數 */
  async start(mode: 'focus' | 'rest'): Promise<TimerState> {
    const settings = settingsStore.get();
    const seconds = mode === 'focus' ? settings.focusSeconds : settings.restSeconds;
    const totalMs = seconds * 1000;

    this.mode = mode;
    this.totalMs = totalMs;
    this.targetTimestamp = Date.now() + totalMs;
    this.pausedRemainingMs = 0;
    this.isRunning = true;
    this.isPaused = false;

    this.startTickLoop();
    this.emitStateChanged();
    return this.getState();
  }

  /** 暫停 */
  pause(): TimerState {
    if (!this.isRunning || this.isPaused || this.mode === 'idle') {
      return this.getState();
    }
    this.pausedRemainingMs = Math.max(0, this.targetTimestamp - Date.now());
    this.isPaused = true;
    this.stopTickLoop();
    this.emitStateChanged();
    return this.getState();
  }

  /** 從暫停中恢復 */
  resume(): TimerState {
    if (!this.isPaused || this.mode === 'idle') {
      return this.getState();
    }
    this.targetTimestamp = Date.now() + this.pausedRemainingMs;
    this.pausedRemainingMs = 0;
    this.isPaused = false;
    this.isRunning = true;
    this.startTickLoop();
    this.emitStateChanged();
    return this.getState();
  }

  /** 切換 暫停 / 恢復；若處於 idle，使用預設模式啟動 */
  async toggleRunning(defaultMode: 'focus' | 'rest' = 'focus'): Promise<TimerState> {
    if (this.mode === 'idle') {
      return this.start(defaultMode);
    }
    if (this.isPaused) {
      return this.resume();
    }
    return this.pause();
  }

  /**
   * 使用者重置：idle 不變；專注／休息則載入該模式設定的完整時長並等同按下暫停（不進行倒數）。
   */
  reset(): TimerState {
    if (this.mode === 'idle') {
      this.stopTickLoop();
      this.totalMs = 0;
      this.targetTimestamp = 0;
      this.pausedRemainingMs = 0;
      this.isRunning = false;
      this.isPaused = false;
      this.emitStateChanged();
      return this.getState();
    }

    const settings = settingsStore.get();
    const seconds = this.mode === 'focus' ? settings.focusSeconds : settings.restSeconds;
    const totalMs = seconds * 1000;

    this.stopTickLoop();
    this.totalMs = totalMs;
    this.pausedRemainingMs = totalMs;
    this.isPaused = true;
    this.isRunning = true;
    this.targetTimestamp = 0;

    this.emitStateChanged();
    return this.getState();
  }

  /** 計時完成或流程結束時清空為 idle */
  private clearToIdle(): TimerState {
    this.stopTickLoop();
    this.mode = 'idle';
    this.totalMs = 0;
    this.targetTimestamp = 0;
    this.pausedRemainingMs = 0;
    this.isRunning = false;
    this.isPaused = false;
    this.emitStateChanged();
    return this.getState();
  }

  /** 廣播當前狀態到所有渲染進程 */
  broadcast(): void {
    const state = this.getState();
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.TIMER_TICK, state);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────────────────────

  private computeRemainingMs(): number {
    if (this.mode === 'idle') return 0;
    if (this.isPaused) return this.pausedRemainingMs;
    return Math.max(0, this.targetTimestamp - Date.now());
  }

  private startTickLoop(): void {
    this.stopTickLoop();
    this.tickHandle = setInterval(() => {
      const remaining = this.computeRemainingMs();
      this.broadcast();

      if (remaining <= 0 && this.mode !== 'idle' && !this.isPaused) {
        this.handleComplete();
      }
    }, TICK_INTERVAL_MS);
  }

  private stopTickLoop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private handleComplete(): void {
    this.stopTickLoop();
    this.isRunning = false;
    this.isPaused = false;

    // 鎖定剩餘時間為 0，確保 UI 顯示 00:00；維持 mode 為 focus/rest 讓 Renderer 顯示中央完成提示
    this.targetTimestamp = Date.now();

    // 關閉到 Tray／最小化時仍須帶出主視窗（不再顯示系統右下角通知）
    this.bringWindowsToForeground();
    this.flashWindowAttention();

    this.broadcast();
    this.emitStateChanged();
  }

  /** 使用者關閉「倒數完成」提示後回到 idle */
  dismissCompletion(): TimerState {
    if (this.mode === 'idle') {
      return this.getState();
    }
    if (
      this.isRunning ||
      this.isPaused ||
      (this.mode !== 'focus' && this.mode !== 'rest')
    ) {
      return this.getState();
    }
    if (this.computeRemainingMs() > 0) {
      return this.getState();
    }
    return this.clearToIdle();
  }

  /** 還原、顯示並聚焦所有應用程式視窗（含關閉到 Tray 的隱藏狀態） */
  private bringWindowsToForeground(): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
    if (process.platform === 'darwin') {
      app.focus({ steal: true });
    } else {
      app.focus();
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

  private emitStateChanged(): void {
    const state = this.getState();
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.TIMER_STATE_CHANGED, state);
      }
    }
    this.emit('state-changed', state);
  }
}

export const timerService = new TimerService();
