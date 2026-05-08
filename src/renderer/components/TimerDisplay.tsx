import type { TimerState } from '../../shared/types';
import { useTimerStore } from '../store/timerStore';

interface Props {
  timer: TimerState;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function TimerDisplay({ timer }: Props) {
  const settings = useTimerStore((s) => s.settings);
  const isCompleted =
    timer.mode !== 'idle' && timer.remainingMs === 0 && !timer.isRunning && !timer.isPaused;

  // idle 狀態時顯示預設專注時長作為提示
  const displayMs =
    timer.mode === 'idle' ? settings.focusSeconds * 1000 : timer.remainingMs;

  const label =
    timer.mode === 'idle'
      ? '準備就緒'
      : timer.mode === 'focus'
        ? timer.isPaused
          ? '專注 · 已暫停'
          : '專注中'
        : timer.isPaused
          ? '休息 · 已暫停'
          : '休息中';

  return (
    <div className={`timer-display ${isCompleted ? 'is-completed' : ''}`}>
      <div className="timer-text" aria-live="polite">
        {formatTime(displayMs)}
      </div>
      <div className="timer-label">{label}</div>
    </div>
  );
}
