export type TimerMode = 'focus' | 'rest' | 'idle';

/**
 * 計時器的顯式狀態機：
 * - idle      未啟動
 * - running   倒數中
 * - paused    暫停（含 reset 後「載滿時長待啟動」）
 * - completed 倒數結束、等待使用者關閉完成提示
 */
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TimerState {
  /** 當前模式 */
  mode: TimerMode;
  /** 顯式狀態；isRunning / isPaused 為其衍生欄位 */
  status: TimerStatus;
  /** 當前模式的總時長（毫秒） */
  totalMs: number;
  /** 剩餘時間（毫秒） */
  remainingMs: number;
  /** 是否正在運行（status === 'running'） */
  isRunning: boolean;
  /** 是否暫停（status === 'paused'） */
  isPaused: boolean;
}

export interface AppSettings {
  /** 專注時長（秒） */
  focusSeconds: number;
  /** 休息時長（秒） */
  restSeconds: number;
}

export interface SetDurationPayload {
  mode: 'focus' | 'rest';
  seconds: number;
}

export interface StartTimerPayload {
  mode: 'focus' | 'rest';
}

export interface TimerCompletedPayload {
  mode: 'focus' | 'rest';
}

export type ElectronAPI = {
  send: (channel: string, ...args: unknown[]) => void;
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
};
