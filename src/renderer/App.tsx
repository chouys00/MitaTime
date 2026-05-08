import { useState } from 'react';
import { TimerDisplay } from './components/TimerDisplay';
import { ProgressBar } from './components/ProgressBar';
import { ControlPanel } from './components/ControlPanel';
import { TitleBar } from './components/TitleBar';
import { useElectronBridge } from './hooks/useElectronBridge';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTimerStore } from './store/timerStore';

export function App() {
  useElectronBridge();
  useKeyboardShortcuts();
  const timer = useTimerStore((s) => s.timer);
  const [isHovered, setIsHovered] = useState(false);

  const isRest = timer.mode === 'rest';
  const isFocus = timer.mode === 'focus';

  return (
    <div
      className={`app ${isFocus ? 'mode-focus' : ''} ${isRest ? 'mode-rest' : ''} ${
        isHovered ? 'is-hovered' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="glass-surface" />
      <TitleBar />

      <main className="content">
        <section className="timer-section" aria-label="計時">
          <TimerDisplay timer={timer} />
          <ProgressBar timer={timer} />
        </section>
        <ControlPanel timer={timer} />
      </main>
    </div>
  );
}
