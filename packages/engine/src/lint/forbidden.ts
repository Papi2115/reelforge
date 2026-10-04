/**
 * Globals a scene must not touch (CLAUDE.md §3.2), with messages written for the scene author —
 * usually an LLM — so the diagnostic alone is enough to fix the code.
 */
import type { LintRule } from './diagnostics.js';

export interface ForbiddenGlobal {
  readonly rule: LintRule;
  readonly message: string;
  readonly fix: string;
}

const FROM_T =
  'Derive it from the local time `t` passed to update(t, state, ctx) (seconds since the shot started; ctx.shot.duration is the shot length).';
const SYNC_FIX =
  'Express the timing as a function of t inside update(), e.g. `const visible = t >= 1.5;`. To sync with the voiceover use `ctx.anchor("phrase").t`.';
const USE_RNG =
  'Use ctx.rng() instead — it is seeded per shot (also ctx.rng.range(min, max), ctx.rng.int(min, max), ctx.rng.pick(list)). In update() it restarts from the same seed on every call, so values are stable for a given t.';
const USE_CTX =
  'Remove it. Everything a scene needs comes through ctx: ctx.three (Three.js), ctx.scene, ctx.camera, ctx.kit, ctx.text, ctx.annotate, ctx.palette, ctx.shot (width/height/fps/duration).';
const NO_DATA =
  'Scenes cannot load anything at render time. Put the data in the scene source as constants and use ctx.kit / ctx.palette for assets.';

const ASSET_FIX =
  "Use the project's assets: `const photo = ctx.assets.image('<asset id>')` in build(), then a kit prop such as `ctx.kit.props.photoFrame({ asset: photo })` (the engine decodes and pixelises it).";

/** Three.js loaders (`ctx.three.TextureLoader`...): they fetch and decode files at render time. */
export const THREE_LOADERS: ReadonlySet<string> = new Set([
  'TextureLoader',
  'ImageLoader',
  'ImageBitmapLoader',
  'FileLoader',
  'CubeTextureLoader',
  'DataTextureLoader',
  'CompressedTextureLoader',
  'ObjectLoader',
  'BufferGeometryLoader',
  'MaterialLoader',
  'AnimationLoader',
  'AudioLoader',
]);

export const THREE_LOADER: ForbiddenGlobal = {
  rule: 'no-network',
  message:
    'Three.js loaders fetch and decode files at render time; scenes run offline in a sandbox and must not load anything.',
  fix: ASSET_FIX,
};

function group(
  rule: LintRule,
  names: readonly string[],
  message: (name: string) => string,
  fix: string,
): [string, ForbiddenGlobal][] {
  return names.map((name) => [name, { rule, message: message(name), fix }]);
}

/** Objects that expose the global scope; `globalThis.Date` is reported as `Date`. */
export const GLOBAL_OBJECTS: ReadonlySet<string> = new Set([
  'globalThis',
  'window',
  'self',
  'global',
  'frames',
  'parent',
  'top',
]);

export const FORBIDDEN_GLOBALS: ReadonlyMap<string, ForbiddenGlobal> = new Map([
  ...group(
    'no-wall-clock',
    ['Date'],
    () =>
      '`Date` reads the wall clock (or builds dates the engine does not control), so frames would differ between preview, export and re-renders.',
    `${FROM_T} If you need a calendar date as on-screen text, write it as a string literal.`,
  ),
  ...group(
    'no-wall-clock',
    ['performance'],
    () =>
      '`performance` (performance.now()) measures real elapsed time, which is different on every render.',
    FROM_T,
  ),
  ...group(
    'no-random',
    ['crypto'],
    () =>
      '`crypto` (getRandomValues / randomUUID) produces random values that change on every render.',
    USE_RNG,
  ),
  ...group(
    'no-timers',
    [
      'setTimeout',
      'setInterval',
      'setImmediate',
      'clearTimeout',
      'clearInterval',
      'clearImmediate',
      'queueMicrotask',
      'requestIdleCallback',
    ],
    (name) =>
      `\`${name}\` schedules work on the real clock. The engine renders by seeking to arbitrary times, so timers never line up with the video.`,
    SYNC_FIX,
  ),
  ...group(
    'no-timers',
    ['requestAnimationFrame', 'cancelAnimationFrame'],
    (name) =>
      `\`${name}\` runs on the display refresh, not on video time. The engine calls update(t, state, ctx) for every frame itself.`,
    'Move the per-frame code into update(t, state, ctx) and compute every value from t.',
  ),
  ...group(
    'no-network',
    [
      'fetch',
      'XMLHttpRequest',
      'WebSocket',
      'EventSource',
      'Worker',
      'SharedWorker',
      'importScripts',
    ],
    (name) =>
      `\`${name}\` needs the network or other threads; scenes run offline in a sandbox where it is blocked, and renders must not depend on outside data.`,
    NO_DATA,
  ),
  ...group(
    'no-network',
    [
      'Image',
      'HTMLImageElement',
      'ImageDecoder',
      'VideoDecoder',
      'createImageBitmap',
      'OffscreenCanvas',
      'FileReader',
      'Blob',
      'Response',
    ],
    (name) =>
      `\`${name}\` loads or decodes media inside the scene; decoders differ between machines and the sandbox has no files or network, so pictures would not match between preview and export.`,
    ASSET_FIX,
  ),
  ...group(
    'no-eval',
    ['eval', 'Function'],
    (name) =>
      `\`${name}\` runs code built from strings; it is blocked by the sandbox and hides code from this lint.`,
    'Write the code directly as normal functions.',
  ),
  ...group(
    'no-node',
    ['process', 'require', 'Buffer', '__dirname', '__filename', 'module', 'exports'],
    (name) =>
      `\`${name}\` is a Node.js API; scenes run in a browser sandbox without Node or the file system.`,
    `${USE_CTX} Scenes must not import or require modules.`,
  ),
  ...group(
    'no-host-globals',
    [...GLOBAL_OBJECTS, 'document', 'opener', 'location', 'history', 'navigator', 'screen'],
    (name) =>
      `\`${name}\` reaches the page/host environment, which differs between preview, export and machines (and is isolated by the sandbox).`,
    USE_CTX,
  ),
  ...group(
    'no-host-globals',
    [
      'devicePixelRatio',
      'innerWidth',
      'innerHeight',
      'outerWidth',
      'outerHeight',
      'matchMedia',
      'getComputedStyle',
      'addEventListener',
      'removeEventListener',
      'postMessage',
      'alert',
    ],
    (name) =>
      `\`${name}\` depends on the window the engine happens to run in, so preview and export would disagree.`,
    'Use ctx.shot.width / ctx.shot.height for the frame size; scenes do not receive events — compute everything from t in update().',
  ),
  ...group(
    'no-storage',
    ['localStorage', 'sessionStorage', 'indexedDB', 'caches'],
    (name) =>
      `\`${name}\` keeps state between renders, so the same t could render differently the second time.`,
    'Keep per-shot state in the object returned by build(ctx); compute per-frame values from t.',
  ),
]);

export const MATH_RANDOM: ForbiddenGlobal = {
  rule: 'no-random',
  message: 'Math.random() is non-deterministic: every render would place things differently.',
  fix: USE_RNG,
};
