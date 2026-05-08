import { useEffect, useRef, useState } from 'react';
import { TimerDisplay } from './components/TimerDisplay';
import { ProgressBar } from './components/ProgressBar';
import { ControlPanel } from './components/ControlPanel';
import { TitleBar } from './components/TitleBar';
import { useElectronBridge } from './hooks/useElectronBridge';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTimerStore } from './store/timerStore';
import type { TimerMode, TimerState } from '../shared/types';

export function App() {
  useElectronBridge();
  useKeyboardShortcuts();
  const timer = useTimerStore((s) => s.timer);
  const [completionMode, setCompletionMode] = useState<Exclude<TimerMode, 'idle'> | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const prevTimerRef = useRef<TimerState | null>(null);
  const completedCycleRef = useRef<string | null>(null);
  const overlayTimeoutRef = useRef<number | null>(null);

  const isRest = timer.mode === 'rest';
  const isFocus = timer.mode === 'focus';

  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current !== null) {
        window.clearTimeout(overlayTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const prev = prevTimerRef.current;
    const isCompleted =
      timer.mode !== 'idle' && timer.remainingMs === 0 && !timer.isRunning && !timer.isPaused;
    const cycleKey = isCompleted ? `${timer.mode}:${timer.totalMs}` : null;
    const crossedToCompleted =
      isCompleted &&
      (!prev ||
        prev.mode !== timer.mode ||
        prev.remainingMs > 0 ||
        prev.isRunning ||
        prev.isPaused);

    if (crossedToCompleted && cycleKey !== completedCycleRef.current) {
      completedCycleRef.current = cycleKey;
      setCompletionMode(timer.mode);
      setOverlayVisible(true);
      playCompletionTone(timer.mode);
      if (overlayTimeoutRef.current !== null) {
        window.clearTimeout(overlayTimeoutRef.current);
      }
      overlayTimeoutRef.current = window.setTimeout(() => {
        setOverlayVisible(false);
      }, 3200);
    }

    if (timer.mode === 'idle' || (prev && prev.mode !== timer.mode && timer.mode !== 'idle')) {
      completedCycleRef.current = null;
    }

    prevTimerRef.current = timer;
  }, [timer]);

  const completionTitle =
    completionMode === 'rest' ? '休息結束，回到專注' : '專注結束，該休息了';

  return (
    <div className={`app ${isFocus ? 'mode-focus' : ''} ${isRest ? 'mode-rest' : ''}`}>
      <div className="glass-surface" />
      <div className={`completion-overlay ${overlayVisible ? 'is-visible' : ''}`} aria-hidden>
        <div className="completion-overlay__card">
          <div className="completion-overlay__title">{completionTitle}</div>
          <div className="completion-overlay__desc">倒數完成</div>
        </div>
      </div>
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

function playCompletionTone(mode: Exclude<TimerMode, 'idle'>): void {
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  const baseFrequency = mode === 'focus' ? 780 : 620;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(baseFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.22, now + 0.18);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.36);

  window.setTimeout(() => {
    void context.close();
  }, 450);
}
