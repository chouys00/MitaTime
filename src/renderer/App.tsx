import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { TimerDisplay } from './components/TimerDisplay';
import { ProgressBar } from './components/ProgressBar';
import { ControlPanel } from './components/ControlPanel';
import { TitleBar } from './components/TitleBar';
import { useElectronBridge } from './hooks/useElectronBridge';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ipcTimerDismissCompletion, onTimerCompleted } from './lib/timerIpc';
import { useTimerStore } from './store/timerStore';
import type { TimerMode } from '../shared/types';

// 音效：Wikimedia Commons「Meow.ogg」— Dan Crosby，CC BY-SA 3.0
// https://commons.wikimedia.org/wiki/File:Meow.ogg
import completionMeowUrl from './assets/completion-meow.ogg?url';

export function App() {
  useElectronBridge();
  useKeyboardShortcuts();
  const timer = useTimerStore((s) => s.timer);
  // overlay 淡出過程中 mode 已變回 idle，因此另存最後完成的模式讓標題不閃動
  const [completionMode, setCompletionMode] = useState<Exclude<TimerMode, 'idle'> | null>(null);

  const isRest = timer.mode === 'rest';
  const isFocus = timer.mode === 'focus';
  const overlayVisible = timer.status === 'completed';

  const appClassName = ['app', isFocus && 'mode-focus', isRest && 'mode-rest']
    .filter(Boolean)
    .join(' ');

  // 完成事件（main process 或瀏覽器預覽 fallback 發出）→ 播放音效
  useEffect(() => onTimerCompleted(playCompletionMeow), []);

  // 進入 completed 時記下完成的模式，供 overlay 標題（含淡出期間）使用
  useEffect(() => {
    if (timer.status === 'completed' && (timer.mode === 'focus' || timer.mode === 'rest')) {
      setCompletionMode(timer.mode);
    }
  }, [timer.status, timer.mode]);

  const dismissCompletionOverlay = useCallback(() => {
    if (!overlayVisible) return;
    void ipcTimerDismissCompletion();
  }, [overlayVisible]);

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

function playCompletionMeow(): void {
  // 每次新建 Audio，避免單例在 play() 曾被拒絕後進入錯誤狀態，導致之後即使具使用者手勢也無法出聲
  const completionMeowAudio = new Audio(completionMeowUrl);
  completionMeowAudio.preload = 'auto';
  void completionMeowAudio.play().catch(() => {
    /* 自動播放被瀏覽器擋下時略過 */
  });
}
