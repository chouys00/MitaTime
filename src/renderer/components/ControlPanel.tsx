import { useEffect, useState } from 'react';
import type { AppSettings, TimerState } from '../../shared/types';
import { IPC } from '../../shared/constants';
import {
  ipcTimerPause,
  ipcTimerReset,
  ipcTimerResume,
  ipcTimerStart,
} from '../lib/timerIpc';
import { useTimerStore } from '../store/timerStore';

interface Props {
  timer: TimerState;
}

export function ControlPanel({ timer }: Props) {
  const settings = useTimerStore((s) => s.settings);
  const setSettings = useTimerStore((s) => s.setSettings);

  const [focusMin, setFocusMin] = useState(() => Math.round(settings.focusSeconds / 60));
  const [restSec, setRestSec] = useState(() => settings.restSeconds);

  useEffect(() => {
    setFocusMin(Math.round(settings.focusSeconds / 60));
    setRestSec(settings.restSeconds);
  }, [settings.focusSeconds, settings.restSeconds]);

  const commitFocus = async () => {
    const value = clamp(focusMin, 1, 600);
    setFocusMin(value);
    if (value * 60 === settings.focusSeconds) return;
    const next = (await window.electronAPI.invoke(IPC.SETTINGS_SAVE, {
      focusSeconds: value * 60,
    })) as typeof settings;
    setSettings(next);
  };

  const commitRest = async () => {
    const value = clamp(restSec, 1, 24 * 60 * 60);
    setRestSec(value);
    if (value === settings.restSeconds) return;
    const next = (await window.electronAPI.invoke(IPC.SETTINGS_SAVE, {
      restSeconds: value,
    })) as typeof settings;
    setSettings(next);
  };

  /** 在啟動／重置計時前，把輸入框目前的值寫入 main（避免僅改數字未 blur 時仍用舊設定） */
  const flushPendingSettings = async (): Promise<void> => {
    const focusClamped = clamp(focusMin, 1, 600);
    const restClamped = clamp(restSec, 1, 24 * 60 * 60);
    setFocusMin(focusClamped);
    setRestSec(restClamped);
    const nextFocusSec = focusClamped * 60;
    const cur = useTimerStore.getState().settings;
    if (nextFocusSec === cur.focusSeconds && restClamped === cur.restSeconds) {
      return;
    }
    if (!window.electronAPI) {
      useTimerStore.getState().setSettings({
        ...cur,
        focusSeconds: nextFocusSec,
        restSeconds: restClamped,
      });
      return;
    }
    const next = (await window.electronAPI.invoke(IPC.SETTINGS_SAVE, {
      focusSeconds: nextFocusSec,
      restSeconds: restClamped,
    })) as AppSettings;
    useTimerStore.getState().setSettings(next);
  };

  const handleStartFocus = async () => {
    await flushPendingSettings();
    await ipcTimerStart('focus');
  };

  const handleStartRest = async () => {
    await flushPendingSettings();
    await ipcTimerStart('rest');
  };

  const handleStart = async () => {
    if (timer.isPaused) {
      void ipcTimerResume();
      return;
    }
    if (timer.mode === 'idle') {
      await flushPendingSettings();
      await ipcTimerStart('focus');
    }
  };

  const handlePause = () => {
    void ipcTimerPause();
  };

  const handleReset = async () => {
    await flushPendingSettings();
    await ipcTimerReset();
  };

  const isFocusActive = timer.mode === 'focus';
  const isRestActive = timer.mode === 'rest';

  return (
    <div className="control-panel">
      <div className="settings-row">
        <label className="setting">
          <span className="setting-label">專注</span>
          <input
            type="number"
            className="setting-input"
            min={1}
            max={600}
            value={focusMin}
            onChange={(e) => setFocusMin(Number(e.target.value) || 0)}
            onBlur={commitFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <span className="setting-suffix">分</span>
        </label>

        <label className="setting">
          <span className="setting-label">休息</span>
          <input
            type="number"
            className="setting-input"
            min={1}
            max={86400}
            value={restSec}
            onChange={(e) => setRestSec(Number(e.target.value) || 0)}
            onBlur={commitRest}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <span className="setting-suffix">秒</span>
        </label>
      </div>

      <div className="buttons-row mode-row">
        <button
          type="button"
          className={`btn btn-mode ${isFocusActive ? 'is-active' : ''}`}
          onClick={handleStartFocus}
        >
          [開始專注]
        </button>
        <button
          type="button"
          className={`btn btn-mode ${isRestActive ? 'is-active' : ''}`}
          onClick={handleStartRest}
        >
          [開始休息]
        </button>
      </div>

      <div className="buttons-row control-row">
        <button type="button" className="btn btn-control" onClick={handleStart}>
          開始<span className="kbd-hint">Enter</span>
        </button>
        <button type="button" className="btn btn-control" onClick={handlePause}>
          暫停<span className="kbd-hint">Space</span>
        </button>
        <button type="button" className="btn btn-control" onClick={handleReset}>
          重置<span className="kbd-hint">Esc</span>
        </button>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
