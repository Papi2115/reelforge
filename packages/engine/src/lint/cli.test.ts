import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { runLintCli, type LintCliIo } from './cli.js';
import { formatDiagnostics } from './diagnostics.js';
import { lintScene } from './lint-scene.js';
import { describeLintErrors, lintManifestScenes } from './manifest.js';

const GOOD = `export const meta = { id: 's01', title: 'Good', treatment: 'map' };
export function build(ctx) { return {}; }
export function update(t, state, ctx) {}`;
const WARN = `export const meta = { id: 's02' };
export function build(ctx) { return {}; }
export function update(t, state, ctx) {}`;
const BAD = GOOD.replace('return {};', 'return { x: Math.random() };');

function memoryIo(files: Record<string, string>): LintCliIo & { out: string; err: string } {
  const io = {
    out: '',
    err: '',
    readFile: (file: string): Promise<string> => {
      const content = files[file];
      return content === undefined
        ? Promise.reject(new Error(`ENOENT: ${file}`))
        : Promise.resolve(content);
    },
    stdout: (text: string): void => {
      io.out += text;
    },
    stderr: (text: string): void => {
      io.err += text;
    },
  };
  return io;
}

describe('runLintCli', () => {
  it('exits 0 for clean files and 0 with warnings only', async () => {
    const io = memoryIo({ 'good.js': GOOD, 'warn.js': WARN });
    expect(await runLintCli(['good.js', 'warn.js'], io)).toBe(0);
    expect(io.out).toMatch(/warn\.js:1:14 {2}warning {2}scene-contract/);
    expect(io.out).toMatch(/2 file\(s\): 0 error\(s\), 2 warning\(s\)/);
  });

  it('exits 1 and prints file:line:col, message and fix for errors', async () => {
    const io = memoryIo({ 'scenes/bad.js': BAD });
    expect(await runLintCli(['--', 'scenes/bad.js'], io)).toBe(1);
    expect(io.out).toContain(
      'scenes/bad.js:2:42  error  no-random  Math.random() is non-deterministic',
    );
    expect(io.out).toMatch(/\n {4}fix: Use ctx\.rng\(\) instead/);
  });

  it('prints JSON with --json', async () => {
    const io = memoryIo({ 'bad.js': BAD });
    expect(await runLintCli(['--json', 'bad.js'], io)).toBe(1);
    const parsed: unknown = JSON.parse(io.out);
    expect(parsed).toEqual([
      {
        file: 'bad.js',
        diagnostics: [expect.objectContaining({ rule: 'no-random', line: 2, column: 42 })],
      },
    ]);
  });

  it('exits 2 on usage and read errors', async () => {
    const io = memoryIo({});
    expect(await runLintCli([], io)).toBe(2);
    expect(await runLintCli(['--fix', 'a.js'], io)).toBe(2);
    expect(await runLintCli(['missing.js'], io)).toBe(2);
    expect(io.err).toMatch(/no scene files given/);
    expect(io.err).toMatch(/unknown option --fix/);
    expect(io.err).toMatch(/cannot read missing\.js: Error: ENOENT/);
    expect(await runLintCli(['--help'], io)).toBe(0);
    expect(io.out).toMatch(/^usage: reelforge lint/);
  });
});

describe('manifest lint gate', () => {
  const manifest = (source: string): RenderManifest => ({
    version: 1,
    fps: 30,
    seed: 1,
    shots: [
      { id: 's01', t0: 0, t1: 1, scene: { file: 'scenes/a.js', source: GOOD } },
      { id: 's02', t0: 1, t1: 2, scene: { file: 'scenes/b.js', source } },
    ],
  });

  it('passes when scenes only have warnings', () => {
    const results = lintManifestScenes(manifest(WARN));
    expect(results.map((result) => result.diagnostics.length)).toEqual([0, 2]);
    expect(describeLintErrors(results)).toBeUndefined();
  });

  it('describes error-level problems per shot', () => {
    const text = describeLintErrors(lintManifestScenes(manifest(BAD)));
    expect(text).toBe(
      `[shot s02]\n${formatDiagnostics('scenes/b.js', lintScene(BAD, { filename: 'scenes/b.js' }))}`,
    );
    expect(text).toMatch(/scenes\/b\.js:2:42 {2}error {2}no-random/);
  });
});
