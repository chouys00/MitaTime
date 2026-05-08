import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '../shared/constants';
import type { SetDurationPayload, StartTimerPayload, AppSettings } from '../shared/types';
import { timerService } from './timer';
import { settingsStore } from './settings-store';

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const isMode = (v: unknown): v is 'focus' | 'rest' => v === 'focus' || v === 'rest';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // ─── Timer ─────────────────────────────────────────────────
  ipcMain.handle(IPC.TIMER_START, async (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Invalid payload for timer:start');
    }
    const { mode } = payload as StartTimerPayload;
    if (!isMode(mode)) {
      throw new Error('mode must be "focus" or "rest"');
    }
    return timerService.start(mode);
  });

  ipcMain.handle(IPC.TIMER_PAUSE, () => timerService.pause());
  ipcMain.handle(IPC.TIMER_RESUME, () => timerService.resume());
  ipcMain.handle(IPC.TIMER_RESET, () => timerService.reset());
  ipcMain.handle(IPC.TIMER_TOGGLE_RUNNING, () => timerService.toggleRunning('focus'));
  ipcMain.handle(IPC.TIMER_GET_STATE, () => timerService.getState());

  ipcMain.handle(IPC.TIMER_SET_DURATION, async (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Invalid payload for timer:set-duration');
    }
    const { mode, seconds } = payload as SetDurationPayload;
    if (!isMode(mode)) {
      throw new Error('mode must be "focus" or "rest"');
    }
    if (!isFiniteNumber(seconds) || seconds < 1) {
      throw new Error('seconds must be a positive number');
    }
    const partial: Partial<AppSettings> =
      mode === 'focus' ? { focusSeconds: seconds } : { restSeconds: seconds };
    return settingsStore.save(partial);
  });

  // ─── Settings ──────────────────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_GET, () => settingsStore.get());

  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, payload: unknown) => {
    if (typeof payload !== 'object' || payload === null) {
      throw new Error('Invalid payload for settings:save');
    }
    const { focusSeconds, restSeconds } = payload as Partial<AppSettings>;
    return settingsStore.save({ focusSeconds, restSeconds });
  });

  // ─── Window ────────────────────────────────────────────────
  ipcMain.handle(IPC.WINDOW_HIDE, () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.hide();
    }
  });

  ipcMain.handle(IPC.WINDOW_TOGGLE, () => {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
}
