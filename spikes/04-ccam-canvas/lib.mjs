// Spike 14.0 only: builds the patched harness, serves it, and holds the measurement protocol shared by the
// Chromium (SwiftShader) and Electron runners. See docs/spikes/ccam-canvas.md.
//
// The harness is the real engine + kit bundle with three textual patches applied in memory (the
// repository sources stay untouched): (1) the post pass writes the composed colour instead of the palette
// LUT (stand-in for the truecolor flag of PLAN.md#14.1), (2) a 1920x1080 preset `ccam-spike`, (3) the
// spike fx `inkStageSpike` appended to the kit's hidden app effects.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

export const SPIKE_DIR = import.meta.dirname;
export const ROOT = path.resolve(SPIKE_DIR, '..', '..');
export const OUT_DIR = path.join(SPIKE_DIR, 'out');
export const HARNESS_DIR = path.join(OUT_DIR, 'harness');
const ENGINE = path.join(ROOT, 'packages', 'engine');
const KIT = path.join(ROOT, 'packages', 'kit');
export const engineRequire = createRequire(path.join(ENGINE, 'package.json'));

export const DET_TIMES = [0.5, 3.0, 7.25, 12.0];
export const DURATION = 13;
export const FPS = 24;
const FRAME_CSP = "default-src 'none'; script-src 'self' blob:";

const SPIKE_PRESET = `const SPIKE_PRESET = {
  ...soft480, id: 'ccam-spike', name: 'C-CAM spike', resolution: { width: 1920, height: 1080 },
  dither: { matrix: 'bayer4', spread: 0 }, ao: undefined, vignette: undefined, variation: undefined,
};
`;

function patch(file, contents) {
  const swap = (from, to) => {
    if (!contents.includes(from)) throw new Error(`spike patch: "${from}" not found in ${file}`);
    contents = contents.replace(from, to);
  };
  const posix = file.replaceAll('\\', '/');
  if (posix.endsWith('engine/src/gl/post-shader.ts')) {
    swap(
      'gl_FragColor = vec4(texelFetch(lut, cell, 0).rgb, 1.0);',
      'gl_FragColor = vec4(color, 1.0);',
    );
  } else if (posix.endsWith('engine/src/presets/index.ts')) {
    swap('export const DEFAULT_STYLE_ID', `${SPIKE_PRESET}export const DEFAULT_STYLE_ID`);
    swap('  soft480,\n]);', '  soft480,\n  SPIKE_PRESET,\n]);');
  } else if (posix.endsWith('kit/src/fx/index.ts')) {
    const fx = path.join(SPIKE_DIR, 'frame', 'spike-fx.js').replaceAll('\\', '/');
    contents = `import { inkStageSpike } from '${fx}';\n${contents}`;
    swap('APP_FX_DEFINITIONS = [endCard]', 'APP_FX_DEFINITIONS = [endCard, inkStageSpike]');
  } else {
    return undefined;
  }
  return contents;
}

const patchPlugin = {
  name: 'ccam-spike-patches',
  setup(build) {
    build.onLoad({ filter: /(post-shader|presets[\\/]index|fx[\\/]index)\.ts$/ }, async (args) => {
      const contents = patch(
        args.path,
        (await readFile(args.path, 'utf8')).replaceAll('\r\n', '\n'),
      );
      return contents === undefined ? undefined : { contents, loader: 'ts' };
    });
  },
};

const page = (title, script, head = '') =>
  `<!doctype html>\n<html><head><meta charset="utf-8" />${head}<title>${title}</title></head>` +
  `<body><script src="${script}"></script></body></html>\n`;

export async function buildSpike() {
  const { build } = engineRequire('esbuild');
  await mkdir(HARNESS_DIR, { recursive: true });
  const common = {
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    nodePaths: [path.join(ENGINE, 'node_modules'), path.join(KIT, 'node_modules')],
    alias: {
      '@reelforge/shared': path.join(ROOT, 'packages', 'shared', 'src', 'index.ts'),
      '@reelforge/kit': path.join(KIT, 'src', 'index.ts'),
    },
    logLevel: 'warning',
    plugins: [patchPlugin],
  };
  const entries = [
    [path.join(ENGINE, 'src', 'harness', 'host-entry.ts'), 'harness.js'],
    [path.join(ENGINE, 'src', 'harness', 'frame-entry.ts'), 'engine-frame.js'],
    [path.join(SPIKE_DIR, 'host', 'spike-host.js'), 'spike-host.js'],
  ];
  for (const [entry, out] of entries) {
    await build({ ...common, entryPoints: [entry], outfile: path.join(HARNESS_DIR, out) });
  }
  const csp = `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}" />`;
  await writeFile(path.join(HARNESS_DIR, 'harness.html'), page('spike harness', 'harness.js'));
  await writeFile(
    path.join(HARNESS_DIR, 'engine-frame.html'),
    page('spike engine', 'engine-frame.js', csp),
  );
  return readFile(path.join(HARNESS_DIR, 'spike-host.js'), 'utf8');
}

export async function startServer() {
  const server = createServer((request, response) => {
    const name = path.basename(new URL(request.url ?? '/', 'http://localhost').pathname);
    const type = name.endsWith('.html')
      ? 'text/html'
      : name.endsWith('.js')
        ? 'text/javascript'
        : undefined;
    if (type === undefined) return void response.writeHead(404).end();
    readFile(path.join(HARNESS_DIR, name)).then(
      (body) =>
        response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }).end(body),
      () => response.writeHead(404).end(),
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/harness.html`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export function manifest(options) {
  const fx = JSON.stringify(options);
  const source = `export const meta = { id: 's01_ink', title: 'Ink stage spike' };
export function build(ctx) {
  const stage = ctx.kit.fx.inkStageSpike({ ...${fx}, size: [ctx.shot.width, ctx.shot.height] });
  ctx.scene.add(stage);
  return { stage };
}
export function update(t, state) {
  state.stage.update(t);
}
`;
  const scene = { file: 'scenes/s01_ink.js', source };
  return {
    version: 1,
    style: 'ccam-spike',
    fps: FPS,
    seed: 2115,
    shots: [{ id: 's01', t0: 0, t1: DURATION, scene }],
  };
}

export const frameTimes = (count, step) =>
  Array.from({ length: count }, (_, i) => Math.round(i * step * 1e6) / 1e6);

export function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const round = (v) => Math.round(v * 100) / 100;
  return {
    n: sorted.length,
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    max: round(sorted[sorted.length - 1]),
  };
}

export function png(rgba, width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * The protocol. `call(name, ...args)` runs window.__spike[name] in a host page; `fresh()` returns the
 * `call` of a new page; `memory()` samples { frameHeapMb, processMb } after a GC.
 */
export async function runProtocol({ call, fresh, memory, saveFrame }) {
  const result = { determinism: {}, perf: {}, memory: {} };
  for (const upload of ['canvas', 'pixels']) {
    const full = manifest({ mode: 'full', upload });
    const info = await call('load', full);
    const forward = await call('hashes', DET_TIMES);
    const reverse = (await call('hashes', [...DET_TIMES].reverse())).reverse();
    const repeat = await call('hashes', DET_TIMES);
    await call('load', full);
    const reloaded = await call('hashes', DET_TIMES);
    const compare = [];
    for (const t of DET_TIMES) compare.push(await call('compare', t));
    result.determinism[upload] = { info, forward, reverse, repeat, reloaded, compare };
  }
  const other = await fresh();
  await other('load', manifest({ mode: 'full', upload: 'canvas' }));
  result.determinism.freshPage = await other('hashes', DET_TIMES);
  const perfTimes = frameTimes(72, DURATION / 74);
  for (const [mode, upload] of [
    ['full', 'canvas'],
    ['full', 'pixels'],
    ['upload', 'canvas'],
    ['upload', 'pixels'],
    ['static', 'canvas'],
  ]) {
    await call('load', manifest({ mode, upload }));
    result.perf[`${mode}/${upload}`] = stats(await call('seekTimes', perfTimes));
  }
  const host = await call('paintTimes', perfTimes);
  result.perf.hostPaint = stats(host.paint);
  result.perf.hostGetImageData = stats(host.read);
  for (const upload of ['canvas', 'pixels']) {
    await call('load', manifest({ mode: 'full', upload }));
    await call('soak', frameTimes(24, 1 / FPS));
    const samples = [await memory()];
    for (let block = 0; block < 3; block++) {
      await call(
        'soak',
        frameTimes(100, 1 / FPS).map((t) => t + block * (100 / FPS)),
      );
      samples.push(await memory());
    }
    result.memory[upload] = { everyFrames: 100, samples };
  }
  await call('load', manifest({ mode: 'full', upload: 'canvas' }));
  for (const t of DET_TIMES)
    await saveFrame(t, Buffer.from(await call('frameBase64', t), 'base64'));
  return result;
}
