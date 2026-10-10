/**
 * Entry of the sandboxed engine frame (`engine-frame.html`, iframe `sandbox="allow-scripts"`,
 * opaque origin). Owns the WebGL canvas and the runtime; serves load/seek/reloadShot requests from
 * the parent strictly in arrival order.
 */
import { sceneSourceSchema } from '@reelforge/shared';
import { describeError, EngineError, type EngineErrorData } from '../errors.js';
import { withInkFonts } from '../ink-fonts.js';
import { createRuntime, type EngineRuntime, type LoadInfo } from '../runtime.js';
import { importKitExtensionSource, importSceneSource } from './module-loader.js';
import { RPC_CHANNEL, requestSchema, type RpcRequest } from './protocol.js';

let runtime: EngineRuntime | undefined;
let canvas: HTMLCanvasElement | undefined;
let queue: Promise<void> = Promise.resolve();

function post(message: object, transfer: Transferable[] = []): void {
  // The opaque-origin frame cannot name its parent's origin; it only ever replies to `parent`.
  window.parent.postMessage(message, '*', transfer);
}

function toErrorData(error: unknown): EngineErrorData {
  if (error instanceof EngineError) return error.toData();
  return { code: 'protocol', message: describeError(error) };
}

function freshCanvas(): HTMLCanvasElement {
  canvas?.remove();
  const next = document.createElement('canvas');
  document.body.appendChild(next);
  canvas = next;
  return next;
}

async function load(manifest: unknown): Promise<LoadInfo> {
  runtime?.dispose();
  runtime = undefined;
  const next = await createRuntime(manifest, {
    canvas: freshCanvas(),
    importScene: importSceneSource,
    importKitExtension: importKitExtensionSource,
  });
  runtime = next;
  // Grim Ink: the machine's text fonts, for the export's cache key and report (PLAN.md#14.18).
  return withInkFonts(next.info);
}

async function reloadShot(shotId: string, input: unknown): Promise<LoadInfo> {
  if (!runtime) throw new EngineError('not-loaded', 'reloadShot() before a successful load()');
  const scene = sceneSourceSchema.safeParse(input);
  if (!scene.success) {
    throw new EngineError('invalid-manifest', `invalid scene for shot ${shotId}`, { shotId });
  }
  return runtime.reloadShot(shotId, scene.data);
}

function seek(t: number): ArrayBuffer {
  if (!runtime) throw new EngineError('not-loaded', 'seek() before a successful load()');
  runtime.seek(t);
  return runtime.readFrame().buffer;
}

async function handle(request: RpcRequest): Promise<void> {
  const reply = { channel: RPC_CHANNEL, id: request.id };
  try {
    if (request.method === 'load') {
      post({ ...reply, ok: true, method: 'load', result: await load(request.manifest) });
    } else if (request.method === 'seek') {
      const frame = seek(request.t);
      post({ ...reply, ok: true, method: 'seek', result: { frame } }, [frame]);
    } else if (request.method === 'pick') {
      if (!runtime) throw new EngineError('not-loaded', 'pick() before a successful load()');
      const result = runtime.pick(request.t, request.x, request.y) ?? null;
      post({ ...reply, ok: true, method: 'pick', result });
    } else if (request.method === 'direct') {
      if (!runtime) throw new EngineError('not-loaded', 'direct() before a successful load()');
      runtime.setShotDirection(request.shotId, request.direction ?? undefined);
      post({ ...reply, ok: true, method: 'direct', result: null });
    } else if (request.method === 'reloadShot') {
      const result = await reloadShot(request.shotId, request.scene);
      post({ ...reply, ok: true, method: 'reloadShot', result });
    } else {
      if (!runtime) throw new EngineError('not-loaded', 'checkCards() before a successful load()');
      post({ ...reply, ok: true, method: 'cards', result: runtime.checkCards(request.shotId) });
    }
  } catch (error) {
    post({ ...reply, ok: false, error: toErrorData(error) });
  }
}

window.addEventListener('message', (event) => {
  if (event.source !== window.parent) return;
  const parsed = requestSchema.safeParse(event.data);
  if (!parsed.success) return;
  const request = parsed.data;
  queue = queue.then(() => handle(request));
});

post({ channel: RPC_CHANNEL, type: 'ready' });
