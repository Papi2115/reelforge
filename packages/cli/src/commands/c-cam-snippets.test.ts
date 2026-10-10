/**
 * The Grim Ink calls quoted by the prompts and the kit-docs (prompts `C_CAM_SNIPPETS`, PLAN.md#14.12)
 * run through the real kit: a scene assembled from every snippet, each in the place the prompts
 * teach (build: the stage, the anchors, the cut table; the painter: pose and contacts, the camera,
 * the place, grime, lettering, the person, foreground, the poster in screen space), passes the
 * engine's determinism lint and repaints a `kit.fx.inkStage` (on a recording canvas) at several
 * times without an error, with the sample person and place standing in for the film's own
 * (`broker`, `pawnShop`). A drifted call fails; every `env.ink.*`, `env.brush.*` and `env.time.*`
 * name the texts mention exists on the stage.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { lintScene, resolveStyle } from '@reelforge/engine';
import {
  STAGE_INK_NAMES,
  createKit,
  personFromModule,
  placeFromModule,
  type KitOptions,
  type KitRng,
} from '@reelforge/kit';
import { C_CAM_SNIPPETS, worldPromptText, type CCamSnippet } from '@reelforge/prompts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { C_CAM_TOPIC_NAMES, describeCCamTopic } from './kit-docs-c-cam.js';
import { INK_MODULE_TOPICS, describeInkModulesTopic } from './kit-docs-c-cam-people.js';

const KIT_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'kit');
const three = createRequire(path.join(KIT_DIR, 'package.json'))('three') as KitOptions['three'];
const EXAMPLES = path.join(KIT_DIR, 'examples', 'c-cam');

/** The narration's phrases of the snippets (local seconds). */
const PHRASES: Readonly<Record<string, number>> = { 'knocked twice': 1.5, 'already gone': 3.5 };
const TIMES = [0, 1.2, 1.6, 2.5, 3.6, 4.4, 5.9];

/** Where every snippet goes in a scene (each one exactly once). */
const BUILD: readonly CCamSnippet[] = ['stage', 'anchors', 'cuts'];
const PAINT: readonly CCamSnippet[] = [
  'pose',
  'palm',
  'reach',
  'camera',
  'place',
  'pool',
  'blob',
  'line',
  'stain',
  'crack',
  'hand',
  'person',
  'foreground',
  'fg',
];
const SCREEN: readonly CCamSnippet[] = ['screenBlob', 'poster'];
const UPDATE: readonly CCamSnippet[] = ['paint'];

type Snippets = Readonly<Record<CCamSnippet, string>>;

function sceneSource(snippets: Snippets): string {
  const lines = (names: readonly CCamSnippet[]): string =>
    names.map((name) => `  ${snippets[name]};`).join('\n');
  return [
    "export const meta = { id: 'cx', title: 'Grim Ink snippets', treatment: 'character-scene' };",
    'function paintShot(g, env, s, ctx) {',
    lines(PAINT),
    `  env.ink.fgScreen(g, () => {\n${lines(SCREEN)}\n  });`,
    '}',
    'export function build(ctx) {',
    lines(BUILD),
    '  return s;',
    '}',
    'export function update(t, s, ctx) {',
    '  const stage = s.stage;',
    lines(UPDATE),
    '}',
    '',
  ].join('\n');
}

/** A canvas whose 2D context answers every call (and counts the fills). */
function recordingCanvas(counter: { fills: number }): object {
  const state: Record<string, unknown> = { fillStyle: '#000000', lineWidth: 1, globalAlpha: 1 };
  const context = new Proxy(state, {
    get: (target, name) =>
      typeof name !== 'string'
        ? undefined
        : name in target
          ? target[name]
          : () => {
              if (name === 'fill') counter.fills += 1;
            },
    set: (target, name, value) => {
      if (typeof name === 'string') target[name] = value;
      return true;
    },
  });
  return { width: 0, height: 0, getContext: () => context };
}

function fixedRng(): KitRng {
  return Object.assign(() => 0.5, {
    range: (min: number, max: number) => (min + max) / 2,
    int: (min: number) => min,
    pick: <T>(items: readonly T[]): T => {
      const [first] = items;
      if (first === undefined) throw new RangeError('pick: empty list');
      return first;
    },
    fork: () => fixedRng(),
  });
}

async function exampleNamespace(file: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(path.join(EXAMPLES, file)).href)) as Record<string, unknown>;
}

let inkModules: NonNullable<KitOptions['inkModules']>;
const counter = { fills: 0 };

beforeAll(async () => {
  const baker = await exampleNamespace('people/nightBaker.js');
  const room = await exampleNamespace('places/bakeryBackRoom.js');
  const broker = { person: { ...(baker['person'] as object), id: 'broker' } };
  const pawnShop = { place: { ...(room['place'] as object), id: 'pawnShop' } };
  inkModules = {
    people: [personFromModule(broker, 'kit-ext/people/broker.js')],
    places: [placeFromModule(pawnShop, 'kit-ext/places/pawnShop.js')],
  };
  vi.stubGlobal('document', { createElement: () => recordingCanvas(counter) });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

interface SceneModule {
  build(ctx: unknown): unknown;
  update(t: number, state: unknown, ctx: unknown): void;
}

/** Builds the scene on a fresh c-cam kit and repaints it at every time; returns the fills drawn. */
function run(snippets: Snippets): number {
  const kit = createKit({
    three,
    palette: resolveStyle({ style: 'c-cam' }).palette,
    rng: fixedRng(),
    style: 'c-cam',
    inkModules,
  }).api;
  const ctx = {
    kit,
    scene: { add: () => undefined },
    anchor: (phrase: string) => ({ t: PHRASES[phrase] ?? 2.2 }),
  };
  const script = `${sceneSource(snippets).replaceAll(/^export /gm, '')}\n({ build, update })`;
  const scene = runInNewContext(script, {}) as SceneModule;
  const before = counter.fills;
  const state = scene.build(ctx);
  for (const t of TIMES) scene.update(t, state, ctx);
  return counter.fills - before;
}

const drifted = (name: CCamSnippet, from: string, to: string): Snippets => {
  const code = C_CAM_SNIPPETS[name];
  if (!code.includes(from)) throw new Error(`snippet ${name} no longer contains ${from}`);
  return { ...C_CAM_SNIPPETS, [name]: code.replace(from, to) };
};

/** Every prompt and kit-docs text of the world. */
function worldTexts(): string {
  const docs = [...C_CAM_TOPIC_NAMES, ...INK_MODULE_TOPICS].map(
    (name) => describeCCamTopic(name) ?? describeInkModulesTopic(name) ?? '',
  );
  return [JSON.stringify(worldPromptText('c-cam')), ...docs].join('\n');
}

describe('Grim Ink snippets of the prompts and kit-docs', () => {
  it('place every snippet exactly once', () => {
    const placed = [...BUILD, ...PAINT, ...SCREEN, ...UPDATE].sort();
    expect(placed).toEqual(Object.keys(C_CAM_SNIPPETS).sort());
  });

  it('make a scene that passes the determinism lint', () => {
    expect(lintScene(sceneSource(C_CAM_SNIPPETS), { filename: 'scenes/cx_snippets.js' })).toEqual(
      [],
    );
  });

  it('run on the real kit stage and draw', () => {
    expect(run(C_CAM_SNIPPETS)).toBeGreaterThan(500);
  });

  it('would fail on a call that drifted from the API', () => {
    expect(() => run(drifted('cuts', 'z: 3.4', 'z: 9'))).toThrow(/cut table/);
    expect(() => run(drifted('person', "'three-quarter'", "'sideways'"))).toThrow(/view/);
    expect(() => run(drifted('pose', "'stand'", "'dance'"))).toThrow(/pose/);
    expect(() => run(drifted('person', "'shock'", "'smirk'"))).toThrow(/unknown expression/);
    expect(() => run(drifted('person', "'clockCheck'", "'juggle'"))).toThrow(/gag must be/);
    expect(() => run(drifted('hand', "'hand'", "'serif'"))).toThrow(/face must be one of/);
    expect(() => run(drifted('place', 'pawnShop', 'pawnshop'))).toThrow(/defined ids: pawnShop/);
  });

  it('name only env members the stage has', () => {
    const texts = worldTexts();
    const names = (namespace: string): string[] => [
      ...new Set(
        [...texts.matchAll(new RegExp(`env\\.${namespace}\\.(\\w+)`, 'g'))].map((m) => m[1] ?? ''),
      ),
    ];
    expect(names('ink').length).toBeGreaterThan(15);
    for (const name of names('ink')) expect(STAGE_INK_NAMES, name).toContain(name);
    for (const name of names('brush')) {
      expect(['inkLine', 'brushStroke', 'blob', 'curve'], name).toContain(name);
    }
    const time = ['twos', 'key', 'step', 'seg', 'ease', 'lerp', 'clamp01', 'hash', 'rnd', 'noise1'];
    for (const name of names('time')) expect(time, name).toContain(name);
  });
});
