export type TimerMode = 'focus' | 'rest' | 'idle';

export interface TimerState {
  /** 當前模式 */
  mode: TimerMode;
  /** 當前模式的總時長（毫秒） */
  totalMs: number;
  /** 剩餘時間（毫秒） */
  remainingMs: number;
  /** 是否正在運行（已啟動且未暫停） */
  isRunning: boolean;
  /** 是否暫停 */
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

export type ElectronAPI = {
  send: (channel: string, ...args: unknown[]) => void;
  invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
};
