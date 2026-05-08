import type { TimerState } from '../../shared/types';

interface Props {
  timer: TimerState;
}

export function ProgressBar({ timer }: Props) {
  const progress =
    timer.mode === 'idle' || timer.totalMs === 0
      ? 0
      : Math.min(100, Math.max(0, ((timer.totalMs - timer.remainingMs) / timer.totalMs) * 100));

  return (
    <div className="progress-bar" aria-hidden>
      <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
    </div>
  );
}
