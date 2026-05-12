import type { TimerState } from '../../shared/types';
import { getTimerProgressPercent } from '../lib/timerProgress';

interface Props {
  timer: TimerState;
}

export function ProgressBar({ timer }: Props) {
  const progress = getTimerProgressPercent(timer);

  return (
    <div className="progress-bar" aria-hidden>
      <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
    </div>
  );
}
