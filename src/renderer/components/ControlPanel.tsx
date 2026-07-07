import { useEffect, useRef, useState } from 'react';
import type { TimerState } from '../../shared/types';
import {
  ipcSettingsSave,
  ipcTimerPause,
  ipcTimerReset,
  ipcTimerResume,
  ipcTimerStart,
} from '../lib/timerIpc';
import { useTimerStore } from '../store/timerStore';

interface Props {
  timer: TimerState;
}

/** 輸入停止後自動寫入設定，不必 blur／按 Enter */
const SETTINGS_DEBOUNCE_MS = 400;

export function ControlPanel({ timer }: Props) {
  const settings = useTimerStore((s) => s.settings);

  /** 以字串儲存，避免清空或輸入途中被 clamp 成 1 洗掉內容 */
  const [focusMinStr, setFocusMinStr] = useState(() => String(Math.round(settings.focusSeconds / 60)));
  const [restSecStr, setRestSecStr] = useState(() => String(settings.restSeconds));

  const focusMinStrRef = useRef(focusMinStr);
  const restSecStrRef = useRef(restSecStr);
  focusMinStrRef.current = focusMinStr;
  restSecStrRef.current = restSecStr;

  const focusSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (focusSaveTimerRef.current) clearTimeout(focusSaveTimerRef.current);
      if (restSaveTimerRef.current) clearTimeout(restSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setFocusMinStr(String(Math.round(settings.focusSeconds / 60)));
    setRestSecStr(String(settings.restSeconds));
  }, [settings.focusSeconds, settings.restSeconds]);

  const commitFocusNow = async (rawStr: string) => {
    const parsed = parsePositiveInt(rawStr);
    if (parsed === null) return;
    const value = clamp(parsed, 1, 600);
    setFocusMinStr(String(value));
    const cur = useTimerStore.getState().settings;
    if (value * 60 === cur.focusSeconds) return;
    await ipcSettingsSave({ focusSeconds: value * 60 });
  };

  const commitRestNow = async (rawStr: string) => {
    const parsed = parsePositiveInt(rawStr);
    if (parsed === null) return;
    const value = clamp(parsed, 1, 24 * 60 * 60);
    setRestSecStr(String(value));
    const cur = useTimerStore.getState().settings;
    if (value === cur.restSeconds) return;
    await ipcSettingsSave({ restSeconds: value });
  };

  const scheduleCommitFocus = () => {
    if (focusSaveTimerRef.current) clearTimeout(focusSaveTimerRef.current);
    focusSaveTimerRef.current = setTimeout(() => {
      focusSaveTimerRef.current = null;
      void commitFocusNow(focusMinStrRef.current);
    }, SETTINGS_DEBOUNCE_MS);
  };

  const scheduleCommitRest = () => {
    if (restSaveTimerRef.current) clearTimeout(restSaveTimerRef.current);
    restSaveTimerRef.current = setTimeout(() => {
      restSaveTimerRef.current = null;
      void commitRestNow(restSecStrRef.current);
    }, SETTINGS_DEBOUNCE_MS);
  };

  const flushFocusSave = () => {
    if (focusSaveTimerRef.current) {
      clearTimeout(focusSaveTimerRef.current);
      focusSaveTimerRef.current = null;
    }
    const raw = focusMinStrRef.current;
    if (parsePositiveInt(raw) === null) {
      const cur = useTimerStore.getState().settings;
      setFocusMinStr(String(Math.round(cur.focusSeconds / 60)));
      return;
    }
    void commitFocusNow(raw);
  };

  const flushRestSave = () => {
    if (restSaveTimerRef.current) {
      clearTimeout(restSaveTimerRef.current);
      restSaveTimerRef.current = null;
    }
    const raw = restSecStrRef.current;
    if (parsePositiveInt(raw) === null) {
      const cur = useTimerStore.getState().settings;
      setRestSecStr(String(cur.restSeconds));
      return;
    }
    void commitRestNow(raw);
  };

  /** 在啟動／重置計時前，把輸入框目前的值寫入 main（避免僅改數字未 blur 時仍用舊設定） */
  const flushPendingSettings = async (): Promise<void> => {
    const cur = useTimerStore.getState().settings;
    const focusParsed = parsePositiveInt(focusMinStr);
    const restParsed = parsePositiveInt(restSecStr);
    const focusClamped = focusParsed !== null ? clamp(focusParsed, 1, 600) : Math.round(cur.focusSeconds / 60);
    const restClamped =
      restParsed !== null ? clamp(restParsed, 1, 24 * 60 * 60) : cur.restSeconds;
    setFocusMinStr(String(focusClamped));
    setRestSecStr(String(restClamped));
    const nextFocusSec = focusClamped * 60;
    if (nextFocusSec === cur.focusSeconds && restClamped === cur.restSeconds) {
      return;
    }
    await ipcSettingsSave({ focusSeconds: nextFocusSec, restSeconds: restClamped });
  };

  const handleStartMode = async (mode: 'focus' | 'rest') => {
    await flushPendingSettings();
    await ipcTimerStart(mode);
  };

  const handleStart = async () => {
    if (timer.status === 'paused') {
      void ipcTimerResume();
      return;
    }
    if (timer.status === 'idle') {
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

  const canStart = timer.status === 'idle' || timer.status === 'paused';
  const canPause = timer.status === 'running';

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
            value={focusMinStr}
            onChange={(e) => {
              setFocusMinStr(e.target.value);
              scheduleCommitFocus();
            }}
            onBlur={flushFocusSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                flushFocusSave();
                (e.target as HTMLInputElement).blur();
              }
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
            value={restSecStr}
            onChange={(e) => {
              setRestSecStr(e.target.value);
              scheduleCommitRest();
            }}
            onBlur={flushRestSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                flushRestSave();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          <span className="setting-suffix">秒</span>
        </label>
      </div>

      <div className="buttons-row mode-row">
        <button
          type="button"
          className={`btn btn-mode ${isFocusActive ? 'is-active' : ''}`}
          onClick={() => void handleStartMode('focus')}
        >
          開始專注
        </button>
        <button
          type="button"
          className={`btn btn-mode ${isRestActive ? 'is-active' : ''}`}
          onClick={() => void handleStartMode('rest')}
        >
          開始休息
        </button>
      </div>

      <div className="buttons-row control-row">
        <button type="button" className="btn btn-control" onClick={() => void handleStart()} disabled={!canStart}>
          開始
        </button>
        <button type="button" className="btn btn-control" onClick={handlePause} disabled={!canPause}>
          暫停
        </button>
        <button type="button" className="btn btn-control" onClick={() => void handleReset()}>
          重置
        </button>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/** 可寫入設定的正整數；空白或尚未形成 ≥1 的數字時回 null（不觸發 clamp / 儲存） */
function parsePositiveInt(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const intVal = Math.trunc(n);
  if (intVal < 1) return null;
  return intVal;
}
