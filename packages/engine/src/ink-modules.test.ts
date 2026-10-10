import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { KitExtensionSource } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from './anchors.js';
import type { SceneContext } from './contract.js';
import { EngineError } from './errors.js';
import { inkModuleHandles, loadProjectModules } from './kit-extensions.js';
import { buildShot } from './shot.js';
import { resolveStyle } from './style.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', 'kit', 'examples');
const FILES: Readonly<Record<string, string>> = {
  'kit-ext/people/nightBaker.js': path.join(EXAMPLES, 'c-cam', 'people', 'nightBaker.js'),
  'kit-ext/places/bakeryBackRoom.js': path.join(EXAMPLES, 'c-cam', 'places', 'bakeryBackRoom.js'),
  'kit-ext/props/fridge.js': path.join(EXAMPLES, 'kit-ext', 'fridge.js'),
};
const MODULES: KitExtensionSource[] = [
  { name: 'fridge', file: 'kit-ext/props/fridge.js', source: 'unused in node' },
  { name: 'nightBaker', file: 'kit-ext/people/nightBaker.js', source: 'x', kind: 'people' },
  { name: 'bakeryBackRoom', file: 'kit-ext/places/bakeryBackRoom.js', source: 'x', kind: 'places' },
];

async function importer(extension: KitExtensionSource): Promise<unknown> {
  const file = FILES[extension.file];
  if (file === undefined) throw new Error(`no fixture for ${extension.file}`);
  const namespace: unknown = await import(pathToFileURL(file).href);
  return namespace;
}

describe('people and places in the engine (PLAN.md#14.8)', () => {
  it('loads them for the c-cam style only; props always', async () => {
    const imported: string[] = [];
    const tracking = (extension: KitExtensionSource): Promise<unknown> => {
      imported.push(extension.file);
      return importer(extension);
    };
    const ink = await loadProjectModules({ kitExtensions: MODULES }, 'c-cam', tracking);
    expect(ink.kitExtensions.map((definition) => definition.name)).toEqual(['fridge']);
    expect(ink.inkModules.people.map((person) => person.id)).toEqual(['nightBaker']);
    expect(ink.inkModules.places.map((place) => place.id)).toEqual(['bakeryBackRoom']);
    imported.length = 0;
    const crisp = await loadProjectModules({ kitExtensions: MODULES }, 'crisp', tracking);
    expect(crisp.inkModules).toEqual({ people: [], places: [] });
    expect(imported).toEqual(['kit-ext/props/fridge.js']);
  });

  it('turns contract problems into kit-extension engine errors', async () => {
    const person = MODULES[1];
    if (person === undefined) throw new Error('fixture');
    const namespace = await importer(person);
    const renamed = { ...person, name: 'baker', file: 'kit-ext/people/baker.js' };
    try {
      inkModuleHandles([renamed], [namespace]);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(EngineError);
      expect((error as EngineError).code).toBe('kit-extension');
      expect((error as EngineError).message).toMatch(
        /person\.id is "nightBaker" but the file registers kit\.people\.baker/,
      );
    }
    expect(() => inkModuleHandles([person], [{}])).toThrow(/missing `export const person/);
  });

  it('gives c-cam scenes ctx.kit.people and ctx.kit.places', async () => {
    const modules = await loadProjectModules({ kitExtensions: MODULES }, 'c-cam', importer);
    let seen: readonly unknown[] = [];
    buildShot({
      shot: { id: 's01', t0: 0, duration: 2, width: 1920, height: 1080, fps: 24 },
      module: {
        meta: { id: 's01' },
        build: (ctx: SceneContext) => {
          seen = [ctx.kit.people?.['nightBaker']?.name, ctx.kit.places?.['bakeryBackRoom']?.name];
          return {};
        },
        update: () => undefined,
      },
      projectSeed: 1,
      palette: resolveStyle({ style: 'c-cam' }).palette,
      resolveAnchor: NO_ANCHORS,
      styleId: 'c-cam',
      ...modules,
    });
    expect(seen).toEqual(['The Night Baker', 'The bakery back room']);
  });
});
