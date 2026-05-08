import { useEffect } from 'react';
import { ipcTimerPause, ipcTimerReset, ipcTimerToggleRunning } from '../lib/timerIpc';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * 視窗內快捷鍵：
 *   Enter → 開始 / 繼續（idle 時預設啟動專注；暫停時恢復）
 *   Space → 暫停
 *   Esc   → 重置
 *
 * 在 input / textarea / contenteditable 中輸入時不觸發。
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (isEditableTarget(e.target)) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        void ipcTimerToggleRunning();
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        void ipcTimerPause();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        void ipcTimerReset();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
