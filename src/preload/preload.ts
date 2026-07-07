import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  ALLOWED_RECEIVE_CHANNELS,
  ALLOWED_SEND_CHANNELS,
  type ReceiveChannel,
  type SendChannel,
} from '../shared/constants';

/**
 * 此檔案由 esbuild bundle 成單一檔案（見 package.json 的 build:preload），
 * 因此可以直接 import shared/constants 的白名單 — 不需手動同步兩份清單。
 */
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
