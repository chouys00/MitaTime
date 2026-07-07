import type { TimerState, TimerStatus } from './types';

export type ActiveTimerMode = 'focus' | 'rest';

export interface TimerEngineOptions {
  /** tick 間隔（毫秒） */
  tickIntervalMs: number;
  /** 每次 tick 時回呼（含 start / pause 等狀態轉換之外的高頻更新） */
  onTick?: (state: TimerState) => void;
  /** 離散狀態轉換（start / pause / resume / reset / complete / dismiss）時回呼 */
  onStateChanged?: (state: TimerState) => void;
  /** 倒數結束時回呼 */
  onCompleted?: (mode: ActiveTimerMode) => void;
}

/**
 * 純計時核心（不依賴 Electron / DOM）。
 *
 * 採用「目標時間戳 (Date.now() + duration)」+ 高頻比對的方式，
 * 而非單純的 setInterval 倒數，避免系統休眠造成累計誤差。
 *
 * main process 的 TimerService 與瀏覽器預覽用的 renderer fallback
 * 共用這份實作，確保兩邊行為一致。
 */
export class TimerEngine {
  private mode: 'idle' | ActiveTimerMode = 'idle';
  private totalMs = 0;
  /** 預定結束的時間戳（毫秒） */
  private targetTimestamp = 0;
  /** 暫停時的剩餘毫秒 */
  private pausedRemainingMs = 0;
  private status: TimerStatus = 'idle';
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly opts: TimerEngineOptions) {}

  getState(): TimerState {
    return {
      mode: this.mode,
      status: this.status,
      totalMs: this.totalMs,
      remainingMs: this.computeRemainingMs(),
      isRunning: this.status === 'running',
      isPaused: this.status === 'paused',
    };
  }

  /** 啟動指定模式的倒數 */
  start(mode: ActiveTimerMode, totalMs: number): TimerState {
    this.mode = mode;
    this.totalMs = totalMs;
    this.targetTimestamp = Date.now() + totalMs;
    this.pausedRemainingMs = 0;
    this.status = 'running';

    this.startTickLoop();
    this.emitStateChanged();
    return this.getState();
  }

  /** 暫停 */
  pause(): TimerState {
    if (this.status !== 'running') {
      return this.getState();
    }
    this.pausedRemainingMs = Math.max(0, this.targetTimestamp - Date.now());
    this.status = 'paused';
    this.stopTickLoop();
    this.emitStateChanged();
    return this.getState();
  }

  /** 從暫停中恢復 */
  resume(): TimerState {
    if (this.status !== 'paused') {
      return this.getState();
    }
    this.targetTimestamp = Date.now() + this.pausedRemainingMs;
    this.pausedRemainingMs = 0;
    this.status = 'running';
    this.startTickLoop();
    this.emitStateChanged();
    return this.getState();
  }

  /**
   * 使用者重置：idle 不變；專注／休息則載入指定的完整時長並停在 paused（不倒數）。
   */
  reset(totalMs: number): TimerState {
    if (this.mode === 'idle') {
      return this.clearToIdle();
    }

    this.stopTickLoop();
    this.totalMs = totalMs;
    this.pausedRemainingMs = totalMs;
    this.targetTimestamp = 0;
    this.status = 'paused';

    this.emitStateChanged();
    return this.getState();
  }

  /** 使用者關閉「倒數完成」提示後回到 idle */
  dismissCompletion(): TimerState {
    if (this.status !== 'completed') {
      return this.getState();
    }
    return this.clearToIdle();
  }

  /** 停止 tick loop 並釋放資源（不改變狀態） */
  dispose(): void {
    this.stopTickLoop();
  }

  // ─────────────────────────────────────────────────────────────
  // 私有方法
  // ─────────────────────────────────────────────────────────────

  private clearToIdle(): TimerState {
    this.stopTickLoop();
    this.mode = 'idle';
    this.totalMs = 0;
    this.targetTimestamp = 0;
    this.pausedRemainingMs = 0;
    this.status = 'idle';
    this.emitStateChanged();
    return this.getState();
  }

  private computeRemainingMs(): number {
    if (this.mode === 'idle') return 0;
    if (this.status === 'paused') return this.pausedRemainingMs;
    if (this.status === 'completed') return 0;
    return Math.max(0, this.targetTimestamp - Date.now());
  }

  private startTickLoop(): void {
    this.stopTickLoop();
    this.tickHandle = setInterval(() => {
      const remaining = this.computeRemainingMs();
      this.opts.onTick?.(this.getState());

      if (remaining <= 0 && this.status === 'running') {
        this.handleComplete();
      }
    }, this.opts.tickIntervalMs);
  }

  private stopTickLoop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  private handleComplete(): void {
    if (this.mode === 'idle') return;
    const completedMode = this.mode;

    this.stopTickLoop();
    this.status = 'completed';
    // 鎖定剩餘時間為 0，確保 UI 顯示 00:00；維持 mode 為 focus/rest 讓 UI 顯示完成提示
    this.targetTimestamp = Date.now();

    // 先送出狀態更新（completed），再發完成事件；
    // 讓訂閱端處理完成事件時，看到的狀態已是 completed
    this.opts.onTick?.(this.getState());
    this.emitStateChanged();
    this.opts.onCompleted?.(completedMode);
  }

  private emitStateChanged(): void {
    this.opts.onStateChanged?.(this.getState());
  }
}
