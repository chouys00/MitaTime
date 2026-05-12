import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { TimerDisplay } from './components/TimerDisplay';
import { ProgressBar } from './components/ProgressBar';
import { ControlPanel } from './components/ControlPanel';
import { TitleBar } from './components/TitleBar';
import { useElectronBridge } from './hooks/useElectronBridge';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ipcTimerDismissCompletion } from './lib/timerIpc';
import { useTimerStore } from './store/timerStore';
import type { TimerMode, TimerState } from '../shared/types';

// 音效：Wikimedia Commons「Meow.ogg」— Dan Crosby，CC BY-SA 3.0
// https://commons.wikimedia.org/wiki/File:Meow.ogg
import completionMeowUrl from './assets/completion-meow.ogg?url';

export function App() {
  useElectronBridge();
  useKeyboardShortcuts();
  const timer = useTimerStore((s) => s.timer);
  const [completionMode, setCompletionMode] = useState<Exclude<TimerMode, 'idle'> | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const prevTimerRef = useRef<TimerState | null>(null);
  const completedCycleRef = useRef<string | null>(null);

  const isRest = timer.mode === 'rest';
  const isFocus = timer.mode === 'focus';

  const appClassName = useMemo(
    () => ['app', isFocus && 'mode-focus', isRest && 'mode-rest'].filter(Boolean).join(' '),
    [isFocus, isRest],
  );

  const isCompleted = useMemo(
    () =>
      timer.mode !== 'idle' &&
      timer.remainingMs === 0 &&
      !timer.isRunning &&
      !timer.isPaused,
    [timer.mode, timer.remainingMs, timer.isRunning, timer.isPaused],
  );

  const dismissCompletionOverlay = useCallback(() => {
    if (!overlayVisible) return;
    void ipcTimerDismissCompletion();
  }, [overlayVisible]);

  useEffect(() => {
    const prev = prevTimerRef.current;
    const cycleKey = isCompleted ? `${timer.mode}:${timer.totalMs}` : null;
    const crossedToCompleted =
      isCompleted &&
      (!prev ||
        prev.mode !== timer.mode ||
        prev.remainingMs > 0 ||
        prev.isRunning ||
        prev.isPaused);

    if (
      crossedToCompleted &&
      cycleKey !== completedCycleRef.current &&
      (timer.mode === 'focus' || timer.mode === 'rest')
    ) {
      completedCycleRef.current = cycleKey;
      setCompletionMode(timer.mode);
      setOverlayVisible(true);
      playCompletionMeow();
    }

    if (overlayVisible && !isCompleted) {
      setOverlayVisible(false);
    }

    if (timer.mode === 'idle' || (prev && prev.mode !== timer.mode)) {
      completedCycleRef.current = null;
    }

    prevTimerRef.current = timer;
  }, [timer, overlayVisible, isCompleted]);

  const completionTitle =
    completionMode === 'rest' ? '休息結束' : '專注結束，該休息了';

  const onCompletionOverlayKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dismissCompletionOverlay();
    }
  };

  return (
    <div className={appClassName}>
      <div className="glass-surface" />
      <TitleBar />

      <main className="content">
        <section className="timer-section" aria-label="計時">
          <TimerDisplay timer={timer} />
          <ProgressBar timer={timer} />
        </section>
        <ControlPanel timer={timer} />
      </main>

      <div
        className={['completion-overlay', overlayVisible && 'is-visible'].filter(Boolean).join(' ')}
        role="button"
        tabIndex={overlayVisible ? 0 : -1}
        aria-hidden={!overlayVisible}
        aria-labelledby="completion-overlay-title"
        onClick={dismissCompletionOverlay}
        onKeyDown={onCompletionOverlayKeyDown}
      >
        <div className="completion-overlay__card">
          <div className="completion-overlay__title" id="completion-overlay-title">
            {completionTitle}
          </div>
          <div className="completion-overlay__desc">點擊任意處關閉</div>
        </div>
      </div>
    </div>
  );
}

let completionMeowAudio: HTMLAudioElement | null = null;

function playCompletionMeow(): void {
  if (!completionMeowAudio) {
    completionMeowAudio = new Audio(completionMeowUrl);
    completionMeowAudio.preload = 'auto';
  }
  completionMeowAudio.currentTime = 0;
  void completionMeowAudio.play().catch(() => {
    /* 自動播放被瀏覽器擋下時略過 */
  });
}
