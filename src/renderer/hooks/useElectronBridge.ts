import { useEffect } from 'react';
import { IPC } from '../../shared/constants';
import type { TimerState, AppSettings, TimerCompletedPayload } from '../../shared/types';
import { emitTimerCompleted } from '../lib/timerIpc';
import { useTimerStore } from '../store/timerStore';

/**
 * 連接 Renderer 與 Main：訂閱 IPC tick / state-changed，
 * 並在掛載時主動拉取一次完整狀態。
 */
export function useElectronBridge(): void {
  const setTimer = useTimerStore((s) => s.setTimer);
  const setSettings = useTimerStore((s) => s.setSettings);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      console.warn('electronAPI not available');
      return;
    }

    let mounted = true;

    const unsubTick = api.on(IPC.TIMER_TICK, (...args: unknown[]) => {
      if (!mounted) return;
      const state = args[0] as TimerState | undefined;
      if (state) setTimer(state);
    });

    const unsubState = api.on(IPC.TIMER_STATE_CHANGED, (...args: unknown[]) => {
      if (!mounted) return;
      const state = args[0] as TimerState | undefined;
      if (state) setTimer(state);
    });

    const unsubCompleted = api.on(IPC.TIMER_COMPLETED, (...args: unknown[]) => {
      if (!mounted) return;
      const payload = args[0] as TimerCompletedPayload | undefined;
      if (payload && (payload.mode === 'focus' || payload.mode === 'rest')) {
        emitTimerCompleted(payload.mode);
      }
    });

    void api.invoke<TimerState>(IPC.TIMER_GET_STATE).then((state) => {
      if (mounted && state) setTimer(state);
    });
    void api.invoke<AppSettings>(IPC.SETTINGS_GET).then((settings) => {
      if (mounted && settings) setSettings(settings);
    });

    return () => {
      mounted = false;
      unsubTick();
      unsubState();
      unsubCompleted();
    };
  }, [setTimer, setSettings]);
}
