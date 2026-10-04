/**
 * Host side of the engine sandbox: creates the `sandbox="allow-scripts"` iframe that runs the
 * engine and exposes the harness contract over postMessage (ADR-004). With `timeouts` every call
 * is bounded (a lost reply rejects with HarnessTimeoutError instead of blocking every later call)
 * and `restart()` replaces the frame (the preview's watchdog, PreviewController).
 */
import {
  renderManifestSchema,
  sceneSourceSchema,
  type RenderManifest,
  type SceneSource,
  type ShotDirection,
} from '@reelforge/shared';
import { EngineError } from '../errors.js';
import {
  describeLintErrors,
  lintManifestKitExtensions,
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
  /** Bounded calls (ms); absent = wait for every reply (the render host has its own limits). */
  readonly timeouts?: HarnessTimeouts;
}

export interface HarnessTimeouts {
  /** `load` and `reloadShot` (scene builds). */
  readonly loadMs: number;
  /** Every other call (seek, cards, pick, direct). */
  readonly callMs: number;
}

/** A call the engine frame did not answer in time (the frame may be stuck: restart it). */
export class HarnessTimeoutError extends EngineError {
  constructor(
    readonly method: string,
    readonly limitMs: number,
  ) {
    super('protocol', `the engine frame did not answer ${method}() within ${String(limitMs)} ms`);
    this.name = 'HarnessTimeoutError';
  }
}

/** The sandboxed harness of the host page: the contract plus a frame restart. */
export interface SandboxedHarness extends ReelforgeHarness {
  /**
   * Replaces the engine frame with a fresh one: calls in flight reject, nothing is loaded
   * (`load()` again). For a frame that stopped answering.
   */
  restart(): void;
}

/** Throws a `scene-lint` EngineError when a (schema-valid) manifest has scenes that fail the lint. */
function assertScenesPassLint(manifest: RenderManifest): void {
  // An invalid manifest is reported by the engine with the full schema errors.
  if (!renderManifestSchema.safeParse(manifest).success) return;
  assertNoLintErrors([...lintManifestKitExtensions(manifest), ...lintManifestScenes(manifest)]);
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
  reject(error: Error): void;
}

type HarnessRequest =
  | { method: 'load'; manifest: RenderManifest }
  | { method: 'seek'; t: number }
  | { method: 'cards'; shotId: string }
  | { method: 'reloadShot'; shotId: string; scene: SceneSource }
  | { method: 'pick'; x: number; y: number; t: number }
  | { method: 'direct'; shotId: string; direction: ShotDirection | null };

function createFrame(frameUrl: string): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
  iframe.src = frameUrl;
  return iframe;
}

function limitOf(method: HarnessRequest['method'], timeouts: HarnessTimeouts | undefined) {
  if (timeouts === undefined) return undefined;
  return method === 'load' || method === 'reloadShot' ? timeouts.loadMs : timeouts.callMs;
}

export function createSandboxedHarness(options: SandboxedHarnessOptions): SandboxedHarness {
  let iframe = createFrame(options.frameUrl);
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let duration = 0;
  let lastFrame: Uint8Array<ArrayBuffer> | undefined;
  let markReady: () => void = () => undefined;
  const newReady = (): Promise<void> =>
    new Promise<void>((resolve) => {
      markReady = resolve;
    });
  let ready = newReady();

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

  function restart(): void {
    const gone = new EngineError('protocol', 'the engine frame was restarted');
    for (const entry of pending.values()) entry.reject(gone);
    pending.clear();
    duration = 0;
    lastFrame = undefined;
    ready = newReady();
    iframe.remove();
    iframe = createFrame(options.frameUrl);
    options.container.appendChild(iframe);
  }

  /** Sends one request once the frame is ready; `onSent` gets its id. */
  async function exchange(
    request: HarnessRequest,
    onSent: (id: number) => void,
  ): Promise<RpcResponse> {
    await ready;
    const target = iframe.contentWindow;
    if (!target) throw new EngineError('protocol', 'engine frame is gone');
    const id = nextId;
    nextId += 1;
    const response = new Promise<RpcResponse>((resolve, reject) =>
      pending.set(id, { resolve, reject }),
    );
    onSent(id);
    // The frame has an opaque origin, so '*' is the only usable target origin.
    target.postMessage({ channel: RPC_CHANNEL, id, ...request }, '*');
    return response;
  }

  async function bounded(request: HarnessRequest): Promise<RpcResponse> {
    const limit = limitOf(request.method, options.timeouts);
    if (limit === undefined) return exchange(request, () => undefined);
    let sent: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        // A late reply to this id is dropped.
        if (sent !== undefined) pending.delete(sent);
        reject(new HarnessTimeoutError(request.method, limit));
      }, limit);
    });
    try {
      return await Promise.race([
        exchange(request, (id) => {
          sent = id;
        }),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function call(request: HarnessRequest): Promise<RpcResponse> {
    const result = await bounded(request);
    if (!result.ok) {
      const { code, message, shotId } = result.error;
      throw new EngineError(code, message, shotId === undefined ? {} : { shotId });
    }
    return result;
  }

  return {
    restart,
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
    async setShotDirection(shotId, direction) {
      const response = await call({ method: 'direct', shotId, direction });
      if (response.ok && response.method === 'direct') return;
      throw new EngineError('protocol', 'unexpected reply to setShotDirection()');
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
