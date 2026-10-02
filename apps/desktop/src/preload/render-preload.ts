/**
 * Preload of the hidden render window (bundled to out/preload/render-preload.cjs): only the
 * render-host bridge (calls from main, replies with frames). It exposes nothing of the app API.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import {
  RENDER_HOST_CHANNELS,
  RENDER_HOST_GLOBAL,
  type RenderHostBridge,
  type RenderHostCall,
  type RenderHostReply,
} from '../shared/render-host-contract.js';

let registered = false;

const bridge: RenderHostBridge = {
  onCall(handler: (call: RenderHostCall) => void): void {
    if (registered) return;
    registered = true;
    ipcRenderer.on(RENDER_HOST_CHANNELS.call, (_event: IpcRendererEvent, call: RenderHostCall) => {
      handler(call);
    });
  },
  reply(reply: RenderHostReply): void {
    ipcRenderer.send(RENDER_HOST_CHANNELS.reply, reply);
  },
  ready(): void {
    ipcRenderer.send(RENDER_HOST_CHANNELS.ready, null);
  },
};

contextBridge.exposeInMainWorld(RENDER_HOST_GLOBAL, bridge);
