import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  ALLOWED_SEND_CHANNELS,
  ALLOWED_RECEIVE_CHANNELS,
  type SendChannel,
  type ReceiveChannel,
} from '../shared/constants';

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
