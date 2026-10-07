import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { LintDiagnostic } from './diagnostics.js';
import { COMIC_SFX_OPTIONS } from './lettering-rules.js';
import { lintScene } from './lint-scene.js';

const META = "export const meta = { id: 's08', title: 'Verdict', treatment: 'kinetic-text' };";
const kitRoot = path.resolve(import.meta.dirname, '..', '..', '..', 'kit');

function scene(buildBody: string): string {
  return [
    META,
    `export function build(ctx) {\nconst page = ctx.kit.fx.comicPage({ anchor: ctx.anchor });\n${buildBody}\nreturn { page };\n}`,
    'export function update(t, state) { state.page.update(t); }',
  ].join('\n');
}

const lettering = (source: string): LintDiagnostic[] =>
  lintScene(source, { filename: 'scenes/s08.js' }).filter(
    (diagnostic) => diagnostic.rule === 'lettering-options',
  );

function sceneFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return sceneFiles(full);
    return name.endsWith('.js') ? [full] : [];
  });
}

describe('lettering-options lint', () => {
  it('rejects the real-run crash: a single number for the per-letter rise', () => {
    const found = lettering(scene("page.sfx('SLAM', { rise: 4 });"));
    expect(found).toEqual([
      {
        rule: 'lettering-options',
        severity: 'error',
        line: 4,
        column: 20,
        message:
          'page.sfx() option `rise` takes an array with one number per letter, e.g. [0, 4, -2, 3], not a number; the scene would fail at render.',
        fix: `Give \`rise\` an array with one number per letter, e.g. [0, 4, -2, 3] (options of page.sfx(): ${Object.keys(COMIC_SFX_OPTIONS).join(', ')}).`,
      },
    ]);
  });

  it('names the valid keys for an unknown option', () => {
    const [found] = lettering(scene("page.sfx('SLAM', { x: 1, y: 2, at: 0.5, angle: 0.1 });"));
    expect(found?.message).toBe('page.sfx() has no option `angle`.');
    expect(found?.fix).toContain('angles, rise, fill, shade');
  });

  it('checks literal values only and accepts the real-run fix', () => {
    const fixed =
      "page.sfx('SLAM', { x: 300, y: 96, at: 'in', size: 9, beats: [0, 0.05, 0.13, 0.2], angles: [-0.12, 0.07, -0.04, 0.1], rise: [0, 4, -2, 3], fill: 'yellow', extrude: [3, 3], on: big });";
    expect(lettering(scene(`const big = 1;\n${fixed}`))).toEqual([]);
    expect(
      lettering(
        scene(
          "const r = [1, 2];\npage.sfx('SLAM', { x: 1, y: 2, at: 0, rise: r, size: ctx.shot.duration });",
        ),
      ),
    ).toEqual([]);
    expect(
      lettering(scene("page.sfx('SLAM', { x: '1', y: 2, at: 0, rise: [0, 'up'] });")),
    ).toHaveLength(2);
  });

  it('leaves the ctx sfx API and other calls alone', () => {
    expect(lettering(scene("ctx.sfx.at(0.5, 'hit'); page.caption('X', { rise: 4 });"))).toEqual([]);
  });

  it('mirrors the kit schema of page.sfx', async () => {
    const schemas = pathToFileURL(
      path.join(kitRoot, 'src', 'worlds', 'comic', 'page', 'schemas.ts'),
    ).href;
    const loaded: unknown = await import(schemas);
    const shape: unknown =
      typeof loaded === 'object' && loaded !== null && 'sfxSchema' in loaded
        ? (loaded.sfxSchema as { shape?: unknown }).shape
        : undefined;
    expect(Object.keys(shape as Record<string, unknown>).sort()).toEqual(
      Object.keys(COMIC_SFX_OPTIONS).sort(),
    );
  });

  it('has no false positives on the kit example scenes', () => {
    const flagged = sceneFiles(path.join(kitRoot, 'examples')).flatMap((file) =>
      lettering(readFileSync(file, 'utf8')).map((entry) => `${file}:${String(entry.line)}`),
    );
    expect(flagged).toEqual([]);
  });
});
