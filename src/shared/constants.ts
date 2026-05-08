/**
 * IPC 通道常數
 *
 * 所有跨 process 通訊必須使用這裡定義的常數，
 * 並在 preload 的白名單中註冊。
 */
export const IPC = {
  TIMER_START: 'timer:start',
  TIMER_PAUSE: 'timer:pause',
  TIMER_RESUME: 'timer:resume',
  TIMER_RESET: 'timer:reset',
  TIMER_TOGGLE_RUNNING: 'timer:toggle-running',
  TIMER_GET_STATE: 'timer:get-state',
  TIMER_SET_DURATION: 'timer:set-duration',
  TIMER_DISMISS_COMPLETION: 'timer:dismiss-completion',

  TIMER_TICK: 'timer:tick',
  TIMER_STATE_CHANGED: 'timer:state-changed',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',

  WINDOW_HIDE: 'window:hide',
  WINDOW_TOGGLE: 'window:toggle',
} as const;

export type SendChannel =
  | typeof IPC.TIMER_START
  | typeof IPC.TIMER_PAUSE
  | typeof IPC.TIMER_RESUME
  | typeof IPC.TIMER_RESET
  | typeof IPC.TIMER_TOGGLE_RUNNING
  | typeof IPC.TIMER_GET_STATE
  | typeof IPC.TIMER_SET_DURATION
  | typeof IPC.TIMER_DISMISS_COMPLETION
  | typeof IPC.SETTINGS_GET
  | typeof IPC.SETTINGS_SAVE
  | typeof IPC.WINDOW_HIDE
  | typeof IPC.WINDOW_TOGGLE;

export type ReceiveChannel =
  | typeof IPC.TIMER_TICK
  | typeof IPC.TIMER_STATE_CHANGED;

export const ALLOWED_SEND_CHANNELS: readonly SendChannel[] = [
  IPC.TIMER_START,
  IPC.TIMER_PAUSE,
  IPC.TIMER_RESUME,
  IPC.TIMER_RESET,
  IPC.TIMER_TOGGLE_RUNNING,
  IPC.TIMER_GET_STATE,
  IPC.TIMER_SET_DURATION,
  IPC.TIMER_DISMISS_COMPLETION,
  IPC.SETTINGS_GET,
  IPC.SETTINGS_SAVE,
  IPC.WINDOW_HIDE,
  IPC.WINDOW_TOGGLE,
] as const;

export const ALLOWED_RECEIVE_CHANNELS: readonly ReceiveChannel[] = [
  IPC.TIMER_TICK,
  IPC.TIMER_STATE_CHANGED,
] as const;

/** 預設專注時長（秒） */
export const DEFAULT_FOCUS_SECONDS = 25 * 60;
/** 預設休息時長（秒） */
export const DEFAULT_REST_SECONDS = 5 * 60;
/** 計時器更新頻率（毫秒）*/
export const TICK_INTERVAL_MS = 200;
