/** Electron preload (bundled to out/electron-preload.cjs): exposes the IPC frame sink to the page. */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_FRAME_CHANNEL, type IpcFrameBridge } from '../src/harness-types.ts';

const bridge: IpcFrameBridge = {
  async sendFrame(frame: Uint8Array<ArrayBuffer>): Promise<void> {
    await ipcRenderer.invoke(IPC_FRAME_CHANNEL, frame);
  },
};

contextBridge.exposeInMainWorld('__spikeIpc', bridge);
