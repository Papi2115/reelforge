/**
 * Main <-> hidden render window (render host page, PLAN.md#4.7 / ADR-002). The page hosts the
 * same sandboxed engine frame as the preview (createSandboxedHarness + engine-frame.html) and is
 * driven by main over IPC: `call` (main -> page), `reply` and `ready` (page -> main). Frames go
 * back as RGBA8 bytes in the reply (structured clone). Types only, so the render preload stays
 * free of zod/engine code; main validates replies (main/render/host-replies.ts).
 */
import type { CardDiagnostic, LoadInfo } from '@reelforge/engine';
import type { RenderManifest } from '@reelforge/shared';

/** Built next to the engine frame (renderer static assets, `ENGINE_ASSET_DIR`). */
export const RENDER_HOST_HTML = 'render-host.html';
export const RENDER_HOST_SCRIPT = 'render-host.js';
export const RENDER_HOST_FILES = [RENDER_HOST_HTML, RENDER_HOST_SCRIPT] as const;
/** Preload of the render window (next to the app preload in out/preload/). */
export const RENDER_PRELOAD_FILE = 'render-preload.cjs';

/** `contextBridge` global of the render page. */
export const RENDER_HOST_GLOBAL = 'reelforgeRenderHost';

export const RENDER_HOST_CHANNELS = {
  call: 'render-host:call',
  reply: 'render-host:reply',
  ready: 'render-host:ready',
} as const;

export type RenderHostCall =
  | { readonly id: number; readonly method: 'load'; readonly manifest: RenderManifest }
  /** seek(t) + frame(): replies with the RGBA8 frame. */
  | { readonly id: number; readonly method: 'frame'; readonly t: number }
  | { readonly id: number; readonly method: 'cards'; readonly shotId: string };

export type RenderHostReply =
  | { readonly id: number; readonly ok: true; readonly method: 'load'; readonly info: LoadInfo }
  | { readonly id: number; readonly ok: true; readonly method: 'frame'; readonly frame: Uint8Array }
  | {
      readonly id: number;
      readonly ok: true;
      readonly method: 'cards';
      readonly cards: readonly CardDiagnostic[];
    }
  | {
      readonly id: number;
      readonly ok: false;
      readonly error: { readonly code: string; readonly message: string };
    };

/** What the render preload exposes on `window.reelforgeRenderHost`. */
export interface RenderHostBridge {
  /** Registers the page's call handler (first registration wins). */
  onCall(handler: (call: RenderHostCall) => void): void;
  reply(reply: RenderHostReply): void;
  /** The page is ready for calls. */
  ready(): void;
}
