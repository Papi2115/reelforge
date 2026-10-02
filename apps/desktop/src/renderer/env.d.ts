/// <reference types="vite/client" />
import type { ReelforgeApi } from '../shared/ipc-contract.js';

declare global {
  interface Window {
    /** Exposed by the preload script (src/preload/preload.ts). */
    readonly reelforge: ReelforgeApi;
  }
}
