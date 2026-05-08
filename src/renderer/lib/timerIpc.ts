import { IPC, TICK_INTERVAL_MS } from '../../shared/constants';
import type { TimerState } from '../../shared/types';
import { useTimerStore } from '../store/timerStore';

let warnedNoElectron = false;

function getElectronApi(): NonNullable<Window['electronAPI']> | null {
  const api = window.electronAPI;
  if (!api) {
    if (!warnedNoElectron) {
      warnedNoElectron = true;
      console.warn(
        '[MitaTime] 找不到 electronAPI，改用網頁內建倒數（僅限預覽）。正式使用請以 Electron 視窗執行 pnpm dev。',
      );
    }
    return null;
  }
  return api;
}

function applyReturnedState(next: TimerState): void {
  useTimerStore.getState().setTimer(next);
}

// ── 無 electronAPI 時（例如僅用瀏覽器開發伺服器預覽 UI）的輕量倒數 ──

interface LocalRun {
  mode: 'focus' | 'rest';
  totalMs: number;
  targetTimestamp: number;
  pausedRemainingMs: number;
  isPaused: boolean;
  tickHandle: ReturnType<typeof setInterval> | null;
}

let localRun: LocalRun | null = null;

function stopLocalTick(): void {
  if (localRun?.tickHandle) {
    clearInterval(localRun.tickHandle);
    localRun.tickHandle = null;
  }
}

function discardLocalRun(): void {
  stopLocalTick();
  localRun = null;
}

function computeLocalRemaining(): number {
  if (!localRun) return 0;
  if (localRun.isPaused) return localRun.pausedRemainingMs;
  return Math.max(0, localRun.targetTimestamp - Date.now());
}

function flushLocalToStore(): void {
  if (!localRun) return;
  const remainingMs = computeLocalRemaining();
  useTimerStore.getState().setTimer({
    mode: localRun.mode,
    totalMs: localRun.totalMs,
    remainingMs,
    isRunning: !localRun.isPaused && remainingMs > 0,
    isPaused: localRun.isPaused,
  });
}

function completeLocalRun(): void {
  discardLocalRun();
  useTimerStore.getState().setTimer({
    mode: 'idle',
    totalMs: 0,
    remainingMs: 0,
    isRunning: false,
    isPaused: false,
  });
}

function localTickOnce(): void {
  if (!localRun) return;
  const remaining = computeLocalRemaining();
  flushLocalToStore();
  if (remaining <= 0 && !localRun.isPaused) {
    completeLocalRun();
  }
}

function startLocalTickLoop(): void {
  stopLocalTick();
  if (!localRun) return;
  localRun.tickHandle = setInterval(localTickOnce, TICK_INTERVAL_MS);
}

function startRendererOnlyTimer(mode: 'focus' | 'rest'): void {
  const settings = useTimerStore.getState().settings;
  const seconds = mode === 'focus' ? settings.focusSeconds : settings.restSeconds;
  const totalMs = seconds * 1000;
  discardLocalRun();
  localRun = {
    mode,
    totalMs,
    targetTimestamp: Date.now() + totalMs,
    pausedRemainingMs: 0,
    isPaused: false,
    tickHandle: null,
  };
  flushLocalToStore();
  startLocalTickLoop();
}

function localPause(): void {
  if (!localRun || localRun.isPaused) return;
  localRun.pausedRemainingMs = Math.max(0, localRun.targetTimestamp - Date.now());
  localRun.isPaused = true;
  stopLocalTick();
  flushLocalToStore();
}

function localResume(): void {
  if (!localRun || !localRun.isPaused) return;
  localRun.targetTimestamp = Date.now() + localRun.pausedRemainingMs;
  localRun.pausedRemainingMs = 0;
  localRun.isPaused = false;
  flushLocalToStore();
  startLocalTickLoop();
}

function localReset(): void {
  const t = useTimerStore.getState().timer;
  if (t.mode === 'idle') {
    discardLocalRun();
    useTimerStore.getState().setTimer({
      mode: 'idle',
      totalMs: 0,
      remainingMs: 0,
      isRunning: false,
      isPaused: false,
    });
    return;
  }

  const settings = useTimerStore.getState().settings;
  const seconds = t.mode === 'focus' ? settings.focusSeconds : settings.restSeconds;
  const totalMs = seconds * 1000;

  if (!localRun) {
    localRun = {
      mode: t.mode,
      totalMs,
      targetTimestamp: 0,
      pausedRemainingMs: totalMs,
      isPaused: true,
      tickHandle: null,
    };
    flushLocalToStore();
    return;
  }

  stopLocalTick();
  localRun.totalMs = totalMs;
  localRun.pausedRemainingMs = totalMs;
  localRun.isPaused = true;
  localRun.targetTimestamp = 0;
  localRun.tickHandle = null;
  flushLocalToStore();
}

/**
 * ipcMain.handle 會回傳最新 TimerState；立即寫入 store，
 * 避免僅依賴 webContents.send 時因訂閱時序或事件遺漏導致畫面不更新。
 */
export async function ipcTimerStart(mode: 'focus' | 'rest'): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    startRendererOnlyTimer(mode);
    return;
  }

  discardLocalRun();

  try {
    const state = await api.invoke<TimerState>(IPC.TIMER_START, { mode });
    applyReturnedState(state);
  } catch (e) {
    console.error('[MitaTime] timer:start 失敗', e);
  }
}

export async function ipcTimerPause(): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    localPause();
    return;
  }
  try {
    const state = await api.invoke<TimerState>(IPC.TIMER_PAUSE);
    applyReturnedState(state);
  } catch (e) {
    console.error('[MitaTime] timer:pause 失敗', e);
  }
}

export async function ipcTimerResume(): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    localResume();
    return;
  }
  try {
    const state = await api.invoke<TimerState>(IPC.TIMER_RESUME);
    applyReturnedState(state);
  } catch (e) {
    console.error('[MitaTime] timer:resume 失敗', e);
  }
}

export async function ipcTimerReset(): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    localReset();
    return;
  }
  try {
    const state = await api.invoke<TimerState>(IPC.TIMER_RESET);
    applyReturnedState(state);
  } catch (e) {
    console.error('[MitaTime] timer:reset 失敗', e);
  }
}

export async function ipcTimerToggleRunning(): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    const t = useTimerStore.getState().timer;
    if (t.mode === 'idle') {
      await ipcTimerStart('focus');
      return;
    }
    if (t.isPaused) {
      localResume();
    } else {
      localPause();
    }
    return;
  }
  try {
    const state = await api.invoke<TimerState>(IPC.TIMER_TOGGLE_RUNNING);
    applyReturnedState(state);
  } catch (e) {
    console.error('[MitaTime] timer:toggle-running 失敗', e);
  }
}
