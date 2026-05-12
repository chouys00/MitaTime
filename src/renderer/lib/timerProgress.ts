import type { TimerState } from '../../shared/types';

/** 計時進度百分比 0–100（idle 或總長為 0 時為 0） */
export function getTimerProgressPercent(timer: TimerState): number {
  if (timer.mode === 'idle' || timer.totalMs === 0) return 0;
  return Math.min(100, Math.max(0, ((timer.totalMs - timer.remainingMs) / timer.totalMs) * 100));
}
