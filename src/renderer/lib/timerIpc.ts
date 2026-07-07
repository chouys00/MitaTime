import { IPC, TICK_INTERVAL_MS } from '../../shared/constants';
import type { TimerState, AppSettings } from '../../shared/types';
import { TimerEngine, type ActiveTimerMode } from '../../shared/timer-engine';
import { useTimerStore } from '../store/timerStore';

let warnedNoElectron = false;

export function getElectronApi(): NonNullable<Window['electronAPI']> | null {
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

// ── 倒數完成事件：Electron（timer:completed）與瀏覽器預覽 fallback 走同一個訂閱介面 ──

type CompletionListener = (mode: ActiveTimerMode) => void;

const completionListeners = new Set<CompletionListener>();

/** 訂閱倒數完成事件；回傳取消訂閱函式 */
export function onTimerCompleted(listener: CompletionListener): () => void {
  completionListeners.add(listener);
  return () => {
    completionListeners.delete(listener);
  };
}

/** 通知所有完成事件訂閱者（由 useElectronBridge 與 local fallback 呼叫） */
export function emitTimerCompleted(mode: ActiveTimerMode): void {
  for (const listener of completionListeners) {
    listener(mode);
  }
}

/** 儲存設定；無 electronAPI 時僅更新 renderer store（瀏覽器預覽）。 */
export async function ipcSettingsSave(partial: Partial<AppSettings>): Promise<AppSettings> {
  const api = getElectronApi();
  const cur = useTimerStore.getState().settings;
  if (!api) {
    const next: AppSettings = {
      focusSeconds: partial.focusSeconds ?? cur.focusSeconds,
      restSeconds: partial.restSeconds ?? cur.restSeconds,
    };
    useTimerStore.getState().setSettings(next);
    return next;
  }
  try {
    const next = await api.invoke<AppSettings>(IPC.SETTINGS_SAVE, partial);
    useTimerStore.getState().setSettings(next);
    return next;
  } catch (e) {
    console.error('[MitaTime] settings:save 失敗', e);
    return cur;
  }
}

// ── 無 electronAPI 時（例如僅用瀏覽器開發伺服器預覽 UI）的輕量倒數 ──
// 與 main process 的 TimerService 共用 TimerEngine，確保兩邊行為一致。

let localEngine: TimerEngine | null = null;

function getLocalEngine(): TimerEngine {
  if (!localEngine) {
    localEngine = new TimerEngine({
      tickIntervalMs: TICK_INTERVAL_MS,
      onTick: applyReturnedState,
      onStateChanged: applyReturnedState,
      onCompleted: emitTimerCompleted,
    });
  }
  return localEngine;
}

function localDurationMs(mode: ActiveTimerMode): number {
  const settings = useTimerStore.getState().settings;
  const seconds = mode === 'focus' ? settings.focusSeconds : settings.restSeconds;
  return seconds * 1000;
}

/**
 * ipcMain.handle 會回傳最新 TimerState；立即寫入 store，
 * 避免僅依賴 webContents.send 時因訂閱時序或事件遺漏導致畫面不更新。
 */
export async function ipcTimerStart(mode: ActiveTimerMode): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    getLocalEngine().start(mode, localDurationMs(mode));
    return;
  }
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
    getLocalEngine().pause();
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
    getLocalEngine().resume();
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
    const engine = getLocalEngine();
    const { mode } = engine.getState();
    engine.reset(mode === 'idle' ? 0 : localDurationMs(mode));
    return;
  }
  try {
    const state = await api.invoke<TimerState>(IPC.TIMER_RESET);
    applyReturnedState(state);
  } catch (e) {
    console.error('[MitaTime] timer:reset 失敗', e);
  }
}

export async function ipcTimerDismissCompletion(): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    getLocalEngine().dismissCompletion();
    return;
  }
  try {
    const state = await api.invoke<TimerState>(IPC.TIMER_DISMISS_COMPLETION);
    applyReturnedState(state);
  } catch (e) {
    console.error('[MitaTime] timer:dismiss-completion 失敗', e);
  }
}

export async function ipcTimerToggleRunning(): Promise<void> {
  const api = getElectronApi();
  if (!api) {
    const engine = getLocalEngine();
    const { mode, status } = engine.getState();
    if (mode === 'idle') {
      await ipcTimerStart('focus');
      return;
    }
    if (status === 'paused') {
      engine.resume();
    } else {
      engine.pause();
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
