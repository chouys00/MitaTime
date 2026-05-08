import { useEffect, useState } from 'react';
import type { TimerState } from '../../shared/types';
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
  const [restMin, setRestMin] = useState(() => Math.round(settings.restSeconds / 60));

  useEffect(() => {
    setFocusMin(Math.round(settings.focusSeconds / 60));
    setRestMin(Math.round(settings.restSeconds / 60));
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
    const value = clamp(restMin, 1, 240);
    setRestMin(value);
    if (value * 60 === settings.restSeconds) return;
    const next = (await window.electronAPI.invoke(IPC.SETTINGS_SAVE, {
      restSeconds: value * 60,
    })) as typeof settings;
    setSettings(next);
  };

  const handleStartFocus = () => {
    void ipcTimerStart('focus');
  };

  const handleStartRest = () => {
    void ipcTimerStart('rest');
  };

  const handleStart = () => {
    if (timer.isPaused) {
      void ipcTimerResume();
      return;
    }
    if (timer.mode === 'idle') {
      void ipcTimerStart('focus');
    }
  };

  const handlePause = () => {
    void ipcTimerPause();
  };

  const handleReset = () => {
    void ipcTimerReset();
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
            max={240}
            value={restMin}
            onChange={(e) => setRestMin(Number(e.target.value) || 0)}
            onBlur={commitRest}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
          <span className="setting-suffix">分</span>
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
