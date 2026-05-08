import { create } from 'zustand';
import type { TimerState, AppSettings } from '../../shared/types';

interface TimerStore {
  /** 來自 main process 的計時器狀態 */
  timer: TimerState;
  /** 持久化設定 */
  settings: AppSettings;
  setTimer: (state: TimerState) => void;
  setSettings: (settings: AppSettings) => void;
}

const INITIAL_TIMER: TimerState = {
  mode: 'idle',
  totalMs: 0,
  remainingMs: 0,
  isRunning: false,
  isPaused: false,
};

const INITIAL_SETTINGS: AppSettings = {
  focusSeconds: 25 * 60,
  restSeconds: 5 * 60,
};

export const useTimerStore = create<TimerStore>((set) => ({
  timer: INITIAL_TIMER,
  settings: INITIAL_SETTINGS,
  setTimer: (timer) => set({ timer }),
  setSettings: (settings) => set({ settings }),
}));
