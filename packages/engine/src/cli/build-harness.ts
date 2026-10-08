/**
 * Bundles the harness pages into `packages/engine/out/harness/`:
 * - `harness.html` + `harness.js`: host page exposing `window.__reelforge`;
 * - `engine-frame.html` + `engine-frame.js`: the engine, loaded by the host in a sandboxed iframe.
 *
 * Several processes may build at once (every `reelforge frames` of parallel scene turns), while
 * pages of other processes load these files. So esbuild only bundles in memory and each file is
 * published atomically (temp + rename) and only when its content changed: a reader never gets a
 * truncated script (real film 3: "TypeError … reading 'load'").
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { writeFileAtomicIfChanged, type AtomicWriteOutcome } from './atomic-write.js';
import { ENGINE_ROOT, HARNESS_DIR } from './paths.js';

export { HARNESS_DIR };

/**
 * The engine frame may only run its own bundle and blob: scene modules; no network (fetch/XHR/
 * WebSocket), images, fonts or workers. Scenes get data only through ctx.
 */
const FRAME_CSP = "default-src 'none'; script-src 'self' blob:";

const page = (title: string, script: string, head = ''): string => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    ${head}<title>${title}</title>
  </head>
  <body>
    <script src="${script}"></script>
  </body>
</html>
`;

const ENTRIES = [
  { entry: 'host-entry.ts', out: 'harness.js' },
  { entry: 'frame-entry.ts', out: 'engine-frame.js' },
] as const;

async function bundle(entry: string, outfile: string): Promise<Uint8Array> {
  const result = await build({
    entryPoints: [path.join(ENGINE_ROOT, 'src', 'harness', entry)],
    outfile,
    write: false,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    alias: {
      '@reelforge/shared': path.join(ENGINE_ROOT, '..', 'shared', 'src', 'index.ts'),
      '@reelforge/kit': path.join(ENGINE_ROOT, '..', 'kit', 'src', 'index.ts'),
    },
    logLevel: 'warning',
  });
  const name = path.basename(outfile);
  const output = result.outputFiles.find((file) => path.basename(file.path) === name);
  if (output === undefined) throw new Error(`esbuild produced no ${name}`);
  return output.contents;
}

/** What one build did with each harness file (file name -> outcome). */
export type HarnessBuildReport = Readonly<Record<string, AtomicWriteOutcome>>;

/** Builds the harness into `outDir` and reports per file whether it was (re)written. */
export async function buildHarnessFiles(outDir = HARNESS_DIR): Promise<HarnessBuildReport> {
  await mkdir(outDir, { recursive: true });
  const target = path.resolve(outDir);
  const scripts = await Promise.all(
    ENTRIES.map(async ({ entry, out }) => ({
      out,
      contents: Buffer.from(await bundle(entry, path.join(target, out))),
    })),
  );
  const frameHead = `<meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}" />\n    `;
  const files = [
    ...scripts,
    { out: 'harness.html', contents: page('reelforge harness', 'harness.js') },
    { out: 'engine-frame.html', contents: page('reelforge engine', 'engine-frame.js', frameHead) },
  ];
  const report: Record<string, AtomicWriteOutcome> = {};
  // Scripts first: a page only references them, so the pages never point at a missing script.
  for (const { out, contents } of files) {
    report[out] = await writeFileAtomicIfChanged(path.join(target, out), contents);
  }
  return report;
}

export async function buildHarness(outDir = HARNESS_DIR): Promise<string> {
  await buildHarnessFiles(outDir);
  return outDir;
}
