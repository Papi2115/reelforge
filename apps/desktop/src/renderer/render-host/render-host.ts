/**
 * Render host page of the hidden render window (export frames, render service; ADR-002). Hosts
 * the same sandboxed engine frame as the preview through `createSandboxedHarness` and answers
 * main's calls strictly in arrival order. Bundled by scripts/bundle.ts to
 * `engine/render-host.js`; `?lint` runs the determinism lint before every load (as the preview).
 */
import { createSandboxedHarness, EngineError } from '@reelforge/engine';
import { z } from 'zod';
import { ENGINE_FRAME_HTML } from '../../shared/engine-assets.js';
import {
  RENDER_HOST_GLOBAL,
  type RenderHostBridge,
  type RenderHostCall,
  type RenderHostReply,
} from '../../shared/render-host-contract.js';

// The page CSP forbids eval; skip zod's `new Function` probe (engine protocol schemas).
z.config({ jitless: true });

declare global {
  interface Window {
    [RENDER_HOST_GLOBAL]?: RenderHostBridge;
  }
}

const bridge = window[RENDER_HOST_GLOBAL];
if (bridge === undefined) throw new Error('render host: the render preload is missing');

const harness = createSandboxedHarness({
  frameUrl: new URL(ENGINE_FRAME_HTML, window.location.href).href,
  container: document.body,
  lintScenes: new URLSearchParams(window.location.search).has('lint'),
});

async function answer(call: RenderHostCall): Promise<RenderHostReply> {
  switch (call.method) {
    case 'load':
      return { id: call.id, ok: true, method: 'load', info: await harness.load(call.manifest) };
    case 'frame':
      await harness.seek(call.t);
      return { id: call.id, ok: true, method: 'frame', frame: harness.frame() };
    case 'cards':
      return {
        id: call.id,
        ok: true,
        method: 'cards',
        cards: await harness.checkCards(call.shotId),
      };
  }
}

function failure(id: number, error: unknown): RenderHostReply {
  if (error instanceof EngineError) {
    return { id, ok: false, error: { code: error.code, message: error.message } };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { id, ok: false, error: { code: 'protocol', message } };
}

let queue: Promise<void> = Promise.resolve();
bridge.onCall((call) => {
  queue = queue.then(async () => {
    bridge.reply(await answer(call).catch((error: unknown) => failure(call.id, error)));
  });
});
bridge.ready();
