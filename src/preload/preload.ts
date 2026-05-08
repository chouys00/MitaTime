import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { ReceiveChannel, SendChannel } from '../shared/constants';

/**
 * Sandbox preload 內無 __dirname、無法 require 同捆檔、亦無法 require('node:path')。
 * 下列清單須與 src/shared/constants.ts 的 ALLOWED_* 保持完全一致。
 */
const ALLOWED_SEND_CHANNELS = [
  'timer:start',
  'timer:pause',
  'timer:resume',
  'timer:reset',
  'timer:toggle-running',
  'timer:get-state',
  'timer:set-duration',
  'settings:get',
  'settings:save',
  'window:hide',
  'window:toggle',
] as const satisfies readonly SendChannel[];

const ALLOWED_RECEIVE_CHANNELS = [
  'timer:tick',
  'timer:state-changed',
] as const satisfies readonly ReceiveChannel[];

const isAllowedSend = (channel: string): channel is SendChannel =>
  (ALLOWED_SEND_CHANNELS as readonly string[]).includes(channel);

const isAllowedReceive = (channel: string): channel is ReceiveChannel =>
  (ALLOWED_RECEIVE_CHANNELS as readonly string[]).includes(channel);

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel: string, ...args: unknown[]): void => {
    if (isAllowedSend(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[preload] Blocked send to channel: ${channel}`);
    }
  },

  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (isAllowedSend(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel "${channel}" is not allowed`));
  },

  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!isAllowedReceive(channel)) {
      console.warn(`[preload] Blocked subscribe to channel: ${channel}`);
      return () => {
        /* noop */
      };
    }
    const listener = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
