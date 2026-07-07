import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerEngine } from './timer-engine';
import type { TimerState } from './types';

const TICK_MS = 200;

function createEngine(overrides?: {
  onTick?: (state: TimerState) => void;
  onStateChanged?: (state: TimerState) => void;
  onCompleted?: (mode: 'focus' | 'rest') => void;
}) {
  return new TimerEngine({
    tickIntervalMs: TICK_MS,
    ...overrides,
  });
}

describe('TimerEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始為 idle', () => {
    const engine = createEngine();
    expect(engine.getState()).toEqual({
      mode: 'idle',
      status: 'idle',
      totalMs: 0,
      remainingMs: 0,
      isRunning: false,
      isPaused: false,
    });
  });

  it('start 後進入 running，剩餘時間等於總時長', () => {
    const engine = createEngine();
    const state = engine.start('focus', 1500_000);
    expect(state.mode).toBe('focus');
    expect(state.status).toBe('running');
    expect(state.totalMs).toBe(1500_000);
    expect(state.remainingMs).toBe(1500_000);
    expect(state.isRunning).toBe(true);
    expect(state.isPaused).toBe(false);
  });

  it('時間前進時 remainingMs 隨之遞減並觸發 onTick', () => {
    const onTick = vi.fn();
    const engine = createEngine({ onTick });
    engine.start('focus', 10_000);
    vi.advanceTimersByTime(1_000);
    expect(engine.getState().remainingMs).toBe(9_000);
    expect(onTick).toHaveBeenCalled();
  });

  it('pause 凍結剩餘時間；經過時間不影響', () => {
    const engine = createEngine();
    engine.start('rest', 10_000);
    vi.advanceTimersByTime(2_000);
    const paused = engine.pause();
    expect(paused.status).toBe('paused');
    expect(paused.isPaused).toBe(true);
    expect(paused.isRunning).toBe(false);
    vi.advanceTimersByTime(5_000);
    expect(engine.getState().remainingMs).toBe(8_000);
  });

  it('resume 從凍結的剩餘時間繼續倒數', () => {
    const engine = createEngine();
    engine.start('focus', 10_000);
    vi.advanceTimersByTime(2_000);
    engine.pause();
    vi.advanceTimersByTime(60_000);
    engine.resume();
    expect(engine.getState().status).toBe('running');
    vi.advanceTimersByTime(1_000);
    expect(engine.getState().remainingMs).toBe(7_000);
  });

  it('idle 時 pause / resume 為 no-op', () => {
    const engine = createEngine();
    expect(engine.pause().status).toBe('idle');
    expect(engine.resume().status).toBe('idle');
  });

  it('倒數到 0 進入 completed：保留 mode、觸發一次 onCompleted', () => {
    const onCompleted = vi.fn();
    const engine = createEngine({ onCompleted });
    engine.start('focus', 1_000);
    vi.advanceTimersByTime(2_000);
    const state = engine.getState();
    expect(state.status).toBe('completed');
    expect(state.mode).toBe('focus');
    expect(state.remainingMs).toBe(0);
    expect(state.isRunning).toBe(false);
    expect(state.isPaused).toBe(false);
    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(onCompleted).toHaveBeenCalledWith('focus');
    // 完成後 tick loop 已停止，不會重複觸發
    vi.advanceTimersByTime(10_000);
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it('completed 後 dismissCompletion 回到 idle', () => {
    const engine = createEngine();
    engine.start('rest', 1_000);
    vi.advanceTimersByTime(2_000);
    const state = engine.dismissCompletion();
    expect(state.status).toBe('idle');
    expect(state.mode).toBe('idle');
    expect(state.totalMs).toBe(0);
  });

  it('倒數中 dismissCompletion 為 no-op', () => {
    const engine = createEngine();
    engine.start('focus', 10_000);
    vi.advanceTimersByTime(1_000);
    const state = engine.dismissCompletion();
    expect(state.status).toBe('running');
    expect(state.remainingMs).toBe(9_000);
  });

  it('同模式完成後再啟動、再完成，onCompleted 會再次觸發', () => {
    const onCompleted = vi.fn();
    const engine = createEngine({ onCompleted });
    engine.start('focus', 1_000);
    vi.advanceTimersByTime(2_000);
    engine.start('focus', 1_000);
    expect(engine.getState().status).toBe('running');
    vi.advanceTimersByTime(2_000);
    expect(onCompleted).toHaveBeenCalledTimes(2);
  });

  it('reset：運行中時載入指定總時長並停在 paused（不倒數）', () => {
    const engine = createEngine();
    engine.start('focus', 10_000);
    vi.advanceTimersByTime(3_000);
    const state = engine.reset(20_000);
    expect(state.status).toBe('paused');
    expect(state.mode).toBe('focus');
    expect(state.totalMs).toBe(20_000);
    expect(state.remainingMs).toBe(20_000);
    vi.advanceTimersByTime(5_000);
    expect(engine.getState().remainingMs).toBe(20_000);
  });

  it('reset：idle 時維持 idle 並清空', () => {
    const engine = createEngine();
    const state = engine.reset(10_000);
    expect(state).toEqual({
      mode: 'idle',
      status: 'idle',
      totalMs: 0,
      remainingMs: 0,
      isRunning: false,
      isPaused: false,
    });
  });

  it('reset 後 resume 可從完整時長開始倒數', () => {
    const engine = createEngine();
    engine.start('rest', 10_000);
    vi.advanceTimersByTime(3_000);
    engine.reset(10_000);
    engine.resume();
    vi.advanceTimersByTime(1_000);
    expect(engine.getState().status).toBe('running');
    expect(engine.getState().remainingMs).toBe(9_000);
  });

  it('狀態轉換時觸發 onStateChanged', () => {
    const onStateChanged = vi.fn();
    const engine = createEngine({ onStateChanged });
    engine.start('focus', 10_000);
    engine.pause();
    engine.resume();
    // start / pause / resume 各一次
    expect(onStateChanged).toHaveBeenCalledTimes(3);
    expect(onStateChanged.mock.calls[1][0].status).toBe('paused');
  });

  it('dispose 停止 tick loop', () => {
    const onTick = vi.fn();
    const engine = createEngine({ onTick });
    engine.start('focus', 10_000);
    engine.dispose();
    onTick.mockClear();
    vi.advanceTimersByTime(2_000);
    expect(onTick).not.toHaveBeenCalled();
  });
});
