import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { createKit } from '../../../kit.js';
import { CRISP_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { RecordingPaint } from '../draw/recording-paint.js';
import { C_CAM_ID } from '../style.js';
import {
  bindLibraries,
  defineLibrary,
  libraryFromModule,
  withModuleLibraries,
  type LibraryInk,
} from './library.js';
import { definePerson } from './person.js';
import { definePlace } from './place.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'c-cam');

/** A film library like the concept films' props.js: a drawing helper and a pose helper. */
const PROPS = {
  slip(g: unknown, ink: unknown, x: unknown, y: unknown) {
    const tools = ink as LibraryInk;
    const [px, py] = [Number(x), Number(y)];
    tools.blob(
      [px - 26, py - 18, px + 26, py - 20, px + 28, py + 18, px - 24, py + 20],
      tools.C.LINEN,
      {
        seed: 4,
        lw: 4,
      },
    );
    return {
      zoom: tools.zoom,
      lw: tools.lw,
      hasLib: typeof tools.lib === 'object',
      g: g !== undefined,
    };
  },
  seat(D: unknown, over: unknown) {
    return { D, over };
  },
  /** Calls a sibling library through `ink.lib`. */
  pile(g: unknown, ink: unknown) {
    const tools = ink as LibraryInk;
    return tools.lib['props']?.['slip']?.(g, tools, 10, 20);
  },
};

describe('Grim Ink libraries (PLAN.md#14.19)', () => {
  it('checks a library module: an object of functions only', () => {
    const library = libraryFromModule({ lib: PROPS }, 'props', 'kit-ext/lib/props.js');
    expect(library.id).toBe('props');
    expect(Object.keys(library.functions)).toEqual(['slip', 'seat', 'pile']);
    expect(() => libraryFromModule({}, 'x', 'kit-ext/lib/x.js')).toThrow(
      /kit-ext\/lib\/x\.js: missing `export const lib/,
    );
    expect(() => defineLibrary({ size: 3 }, 'x')).toThrow(/lib\.size must be a function/);
    expect(() => defineLibrary([], 'x')).toThrow(KitError);
  });

  it("gives a drawing helper the toolbox at the env's ink width, and passes other helpers through", () => {
    const { registry } = bindLibraries([defineLibrary(PROPS, 'props')]);
    const props = registry['props'] ?? {};
    const g = new RecordingPaint();
    const camEnv = { zoom: 2, lw: 0.68, t: 1 };
    expect(props['slip']?.(g, camEnv, 100, 200)).toEqual({
      zoom: 2,
      lw: 0.68,
      hasLib: true,
      g: true,
    });
    expect(g.calls.length).toBeGreaterThan(5);
    expect(props['seat']?.({ sy: -1 }, { lean: 3 })).toEqual({ D: { sy: -1 }, over: { lean: 3 } });
    expect(props['pile']?.(g, camEnv)).toMatchObject({ zoom: 2, hasLib: true });
    expect(() => registry['nope']).toThrow(
      /kit\.lib\.nope is not defined: defined ids: props; write kit-ext\/lib\/nope\.js/,
    );
  });

  it('draws the same strokes from a scene and from a module (deterministic)', () => {
    const { registry, toolbox } = bindLibraries([defineLibrary(PROPS, 'props')]);
    const fromScene = new RecordingPaint();
    registry['props']?.['slip']?.(fromScene, { zoom: 1, lw: 1 }, 50, 60);
    const fromModule = new RecordingPaint();
    registry['props']?.['slip']?.(fromModule, toolbox(fromModule, { zoom: 1, lw: 1 }), 50, 60);
    expect(fromModule.calls).toEqual(fromScene.calls);
  });

  it('gives people and places `ink.lib`, and leaves them as they are without libraries', async () => {
    const namespace = (await import(
      pathToFileURL(path.join(EXAMPLES, 'places', 'bakeryBackRoom.js')).href
    )) as { place: Record<string, unknown> };
    const seen: unknown[] = [];
    const place = {
      ...namespace.place,
      draw(g: unknown, ink: { lib?: unknown }, t: number) {
        seen.push(ink.lib);
        return [g, t];
      },
    };
    expect(withModuleLibraries(place, undefined)).toBe(place);
    const libraries = bindLibraries([defineLibrary(PROPS, 'props')]);
    const bound = definePlace(withModuleLibraries(place, libraries), 'kit-ext/places/room.js');
    bound.draw(new RecordingPaint(), undefined, 1, { light: false });
    expect(seen).toEqual([libraries.registry]);
    const person = (await import(
      pathToFileURL(path.join(EXAMPLES, 'people', 'nightBaker.js')).href
    )) as { person: Record<string, unknown> };
    const drawn = definePerson(withModuleLibraries(person.person, libraries));
    expect(drawn.id).toBe('nightBaker');
  });

  it('binds kit.lib in c-cam shots only', () => {
    const libraries = bindLibraries([defineLibrary(PROPS, 'props')]);
    const options = { three: THREE, palette: CRISP_PALETTE, rng: testRng(3) };
    expect(createKit(options).api.lib).toBeUndefined();
    const ink = createKit({
      ...options,
      style: C_CAM_ID,
      inkModules: { people: [], places: [], lib: libraries.registry },
    });
    expect(Object.keys(ink.api.lib ?? {})).toEqual(['props']);
    const none = createKit({ ...options, style: C_CAM_ID });
    expect(() => none.api.lib?.['crowd']).toThrow(/the project has no lib yet/);
  });
});
