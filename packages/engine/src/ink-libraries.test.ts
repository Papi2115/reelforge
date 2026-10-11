/**
 * PLAN.md#14.19: Grim Ink libraries (`kit-ext/lib/<name>.js`) load with the people and places in
 * the c-cam style only, reach scenes as `ctx.kit.lib` and modules as `ink.lib`, and lint as an
 * object of plain functions.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { KitExtensionSource } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from './anchors.js';
import type { SceneContext } from './contract.js';
import { inkModuleHandles, loadProjectModules } from './kit-extensions.js';
import { inkModuleKindOfPath, lintInkModule } from './lint/lint-ink-module.js';
import { lintModule } from './lint/lint-prop.js';
import { buildShot } from './shot.js';
import { resolveStyle } from './style.js';

const PLACE_FILE = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'kit',
  'examples',
  'c-cam',
  'places',
  'bakeryBackRoom.js',
);

const LIB_SOURCE = `export const lib = {
  seat(D, over) { return { kL: 'flat', kR: 'flat', ...over }; },
  slip(g, ink, x, y, seed) { ink.rough([x - 26, y - 18, x + 26, y - 20, x + 28, y + 18, x - 24, y + 20], ink.C.LINEN, { seed }); },
};
`;

/** A library namespace as the sandbox would import it. */
const LIB_NAMESPACE = {
  lib: {
    tag: (g: unknown, ink: { zoom: number }) => ({ zoom: ink.zoom, painted: g !== undefined }),
  },
};

const MODULES: KitExtensionSource[] = [
  { name: 'bakeryBackRoom', file: 'kit-ext/places/bakeryBackRoom.js', source: 'x', kind: 'places' },
  { name: 'film', file: 'kit-ext/lib/film.js', source: LIB_SOURCE, kind: 'lib' },
];

async function importer(extension: KitExtensionSource): Promise<unknown> {
  if (extension.kind === 'lib') return LIB_NAMESPACE;
  const namespace: unknown = await import(pathToFileURL(PLACE_FILE).href);
  return namespace;
}

describe('Grim Ink libraries in the engine (PLAN.md#14.19)', () => {
  it('loads them for the c-cam style only and gives scenes ctx.kit.lib', async () => {
    const modules = await loadProjectModules({ kitExtensions: MODULES }, 'c-cam', importer);
    expect(Object.keys(modules.inkModules.lib ?? {})).toEqual(['film']);
    const crisp = await loadProjectModules({ kitExtensions: MODULES }, 'crisp', importer);
    expect(crisp.inkModules).toEqual({ people: [], places: [] });
    let seen: unknown;
    buildShot({
      shot: { id: 's01', t0: 0, duration: 2, width: 1920, height: 1080, fps: 24 },
      module: {
        meta: { id: 's01' },
        build: (ctx: SceneContext) => {
          seen = ctx.kit.lib?.['film']?.['tag']?.(
            { beginPath() {}, save() {} },
            { zoom: 2, lw: 1 },
          );
          return null;
        },
        update: () => undefined,
      },
      projectSeed: 1,
      palette: resolveStyle({ style: 'c-cam' }).palette,
      resolveAnchor: NO_ANCHORS,
      styleId: 'c-cam',
      ...modules,
    });
    expect(seen).toEqual({ zoom: 2, painted: true });
  });

  it('keeps people and places exactly as they were without a library', async () => {
    const place = MODULES[0];
    if (place === undefined) throw new Error('fixture');
    const namespace = await importer(place);
    const plain = inkModuleHandles([place], [namespace]);
    expect(plain).toEqual({ people: [], places: plain.places });
    expect(plain.lib).toBeUndefined();
    expect(() => inkModuleHandles([MODULES[1] as KitExtensionSource], [{}])).toThrow(
      /missing `export const lib/,
    );
  });

  it('lints a library as an object of plain functions', () => {
    const file = 'kit-ext/lib/film.js';
    expect(inkModuleKindOfPath(file)).toBe('lib');
    expect(inkModuleKindOfPath('C:\\film\\kit-ext\\lib\\film.js')).toBe('lib');
    expect(lintInkModule(LIB_SOURCE, { filename: file }, 'lib')).toEqual([]);
    expect(lintModule(LIB_SOURCE, { filename: file })).toEqual([]);
    const messages = (source: string): string[] =>
      lintInkModule(source, { filename: file }, 'lib').map((d) => `${d.severity} ${d.message}`);
    expect(messages('export const lib = { size: 3, async load() {} };')).toEqual([
      expect.stringMatching(/^error `lib.size` must be a plain synchronous function/),
      expect.stringMatching(/^error `lib.load` must be a plain synchronous function/),
    ]);
    expect(messages('export const helpers = {};').sort()).toEqual([
      expect.stringMatching(/^error The module does not export `lib`/),
      expect.stringMatching(/^warning The engine only reads `lib`/),
    ]);
    expect(messages('export const lib = { now() { return Date.now(); } };')).toEqual([
      expect.stringMatching(/^error .*Date/),
    ]);
    expect(messages('export const lib = { t(g) { g.fillText("x", 0, 0); } };')).toEqual([
      expect.stringMatching(/^error `fillText` is outside the Grim Ink grammar/),
    ]);
  });
});
