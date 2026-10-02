/**
 * Host side of the engine sandbox: creates the `sandbox="allow-scripts"` iframe that runs the
 * engine and exposes the harness contract over postMessage (ADR-004).
 */
import {
  renderManifestSchema,
  sceneSourceSchema,
  type RenderManifest,
  type SceneSource,
} from '@reelforge/shared';
import { EngineError } from '../errors.js';
import {
  describeLintErrors,
  lintManifestScenes,
  lintShotScene,
  type SceneLintResult,
} from '../lint/manifest.js';
import type { LoadInfo } from '../runtime.js';
import {
  readyMessageSchema,
  responseSchema,
  RPC_CHANNEL,
  type ReelforgeHarness,
  type RpcResponse,
} from './protocol.js';

export interface SandboxedHarnessOptions {
  /** URL of `engine-frame.html`. */
  readonly frameUrl: string;
  /** Element the (invisible) iframe is appended to. */
  readonly container: HTMLElement;
  /**
   * Run the determinism lint (PLAN.md#2.6) on every scene before it is sent to the engine;
   * `load()` rejects with a `scene-lint` error when any scene has error-level diagnostics.
   */
  readonly lintScenes?: boolean;
}

/** Throws a `scene-lint` EngineError when a (schema-valid) manifest has scenes that fail the lint. */
function assertScenesPassLint(manifest: RenderManifest): void {
  // An invalid manifest is reported by the engine with the full schema errors.
  if (!renderManifestSchema.safeParse(manifest).success) return;
  assertNoLintErrors(lintManifestScenes(manifest));
}

/** Same for the new scene of one shot (hot reload); an invalid scene is reported by the engine. */
function assertShotScenePassesLint(shotId: string, scene: SceneSource): void {
  if (!sceneSourceSchema.safeParse(scene).success) return;
  assertNoLintErrors([lintShotScene(shotId, scene)]);
}

function assertNoLintErrors(results: readonly SceneLintResult[]): void {
  const problems = describeLintErrors(results);
  if (problems !== undefined) {
    throw new EngineError(
      'scene-lint',
      `scene lint failed; fix these before the scene can load:\n${problems}`,
    );
  }
}

interface Pending {
  resolve(response: RpcResponse): void;
}

export function createSandboxedHarness(options: SandboxedHarnessOptions): ReelforgeHarness {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
  iframe.src = options.frameUrl;

  const pending = new Map<number, Pending>();
  let nextId = 1;
  let duration = 0;
  let lastFrame: Uint8Array<ArrayBuffer> | undefined;
  let markReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });

  window.addEventListener('message', (event) => {
    if (event.source !== iframe.contentWindow) return;
    if (readyMessageSchema.safeParse(event.data).success) {
      markReady();
      return;
    }
    const parsed = responseSchema.safeParse(event.data);
    if (!parsed.success) return;
    const entry = pending.get(parsed.data.id);
    pending.delete(parsed.data.id);
    entry?.resolve(parsed.data);
  });
  options.container.appendChild(iframe);

  async function call(
    request:
      | { method: 'load'; manifest: RenderManifest }
      | { method: 'seek'; t: number }
      | { method: 'cards'; shotId: string }
      | { method: 'reloadShot'; shotId: string; scene: SceneSource }
      | { method: 'pick'; x: number; y: number; t: number },
  ): Promise<RpcResponse> {
    await ready;
    const target = iframe.contentWindow;
    if (!target) throw new EngineError('protocol', 'engine frame is gone');
    const id = nextId;
    nextId += 1;
    const response = new Promise<RpcResponse>((resolve) => pending.set(id, { resolve }));
    // The frame has an opaque origin, so '*' is the only usable target origin.
    target.postMessage({ channel: RPC_CHANNEL, id, ...request }, '*');
    const result = await response;
    if (!result.ok) {
      const { code, message, shotId } = result.error;
      throw new EngineError(code, message, shotId === undefined ? {} : { shotId });
    }
    return result;
  }

  return {
    async load(manifest) {
      duration = 0;
      lastFrame = undefined;
      if (options.lintScenes === true) assertScenesPassLint(manifest);
      const response = await call({ method: 'load', manifest });
      if (response.ok && response.method === 'load') {
        duration = response.result.duration;
        return response.result satisfies LoadInfo;
      }
      throw new EngineError('protocol', 'unexpected reply to load()');
    },
    async seek(t) {
      const response = await call({ method: 'seek', t });
      if (response.ok && response.method === 'seek') {
        lastFrame = new Uint8Array(response.result.frame);
        return;
      }
      throw new EngineError('protocol', 'unexpected reply to seek()');
    },
    async checkCards(shotId) {
      const response = await call({ method: 'cards', shotId });
      if (response.ok && response.method === 'cards') return response.result;
      throw new EngineError('protocol', 'unexpected reply to checkCards()');
    },
    async reloadShot(shotId, scene) {
      if (options.lintScenes === true) assertShotScenePassesLint(shotId, scene);
      const response = await call({ method: 'reloadShot', shotId, scene });
      if (response.ok && response.method === 'reloadShot') {
        return response.result satisfies LoadInfo;
      }
      throw new EngineError('protocol', 'unexpected reply to reloadShot()');
    },
    async pick(x, y, t) {
      const response = await call({ method: 'pick', x, y, t });
      if (response.ok && response.method === 'pick') return response.result;
      throw new EngineError('protocol', 'unexpected reply to pick()');
    },
    get duration() {
      return duration;
    },
    frame() {
      if (!lastFrame) throw new EngineError('not-loaded', 'frame() before a successful seek()');
      return lastFrame;
    },
  };
}
