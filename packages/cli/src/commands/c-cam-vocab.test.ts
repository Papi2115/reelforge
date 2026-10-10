/**
 * The Grim Ink vocabulary in the docs and scenes (PLAN.md#14.20): one kit-docs topic per family
 * (props in two halves), each under 6 KB and the six under 28 KB together, listing every entry of
 * the kit's registries; the prompts' vocabulary snippets and the five vocabulary examples
 * (packages/kit/examples/c-cam/vocab/) pass the engine's determinism lint and repaint a real kit
 * stage (on a recording canvas) at several times; a drifted call fails with the topic to read.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { lintScene, resolveStyle } from '@reelforge/engine';
import {
  STAGE_INK_NAMES,
  VOCAB_FAMILIES,
  VOCAB_NAMES,
  createKit,
  kitCatalog,
  personFromModule,
  type KitOptions,
  type KitRng,
} from '@reelforge/kit';
import { C_CAM_VOCAB_SNIPPETS, C_CAM_VOCAB_TOPICS } from '@reelforge/prompts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { describeCCamTopic } from './kit-docs-c-cam.js';
import { C_CAM_VOCAB_TOPIC_NAMES, describeInkVocabTopic } from './kit-docs-c-cam-vocab.js';
import { describeKitName } from './kit-docs.js';

const KIT_DIR = path.resolve(import.meta.dirname, '..', '..', '..', 'kit');
const three = createRequire(path.join(KIT_DIR, 'package.json'))('three') as KitOptions['three'];
const EXAMPLES = path.join(KIT_DIR, 'examples', 'c-cam');
const VOCAB_EXAMPLES = path.join(EXAMPLES, 'vocab');
const TIMES = [0, 0.9, 1.6, 2.3, 3.1, 3.7, 4.6, 5.8];
const CATALOG = kitCatalog();

function topic(name: string): string {
  const text = describeInkVocabTopic(name);
  if (text === undefined) throw new Error(`no topic ${name}`);
  return text;
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

async function moduleOf(file: string): Promise<Record<string, unknown>> {
  return (await import(pathToFileURL(file).href)) as Record<string, unknown>;
}

let inkModules: NonNullable<KitOptions['inkModules']>;
const counter = { fills: 0 };

beforeAll(async () => {
  const baker = await moduleOf(path.join(EXAMPLES, 'people', 'nightBaker.js'));
  const engineer = await moduleOf(path.join(EXAMPLES, 'apollo', 'people', 'guidance.js'));
  const as = (namespace: Record<string, unknown>, id: string) =>
    personFromModule(
      { person: { ...(namespace['person'] as object), id } },
      `kit-ext/people/${id}.js`,
    );
  inkModules = {
    people: [
      as(baker, 'nightBaker'),
      as(engineer, 'porter'),
      as(baker, 'broker'),
      as(engineer, 'clerk'),
    ],
    places: [],
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
function run(source: string): number {
  const kit = createKit({
    three,
    palette: resolveStyle({ style: 'c-cam' }).palette,
    rng: fixedRng(),
    style: 'c-cam',
    inkModules,
  }).api;
  const ctx = { kit, scene: { add: () => undefined }, anchor: () => ({ t: 2.2 }) };
  const scene = runInNewContext(
    `${source.replaceAll(/^export /gm, '')}\n({ build, update })`,
    {},
  ) as SceneModule;
  const before = counter.fills;
  const state = scene.build(ctx);
  for (const t of TIMES) scene.update(t, state, ctx);
  return counter.fills - before;
}

type Snippets = Readonly<Record<keyof typeof C_CAM_VOCAB_SNIPPETS, string>>;

function snippetScene(snippets: Snippets): string {
  const paint = Object.values(snippets)
    .map((code) => `  ${code};`)
    .join('\n');
  return [
    "export const meta = { id: 'cv', title: 'Grim Ink vocabulary snippets', treatment: 'character-scene' };",
    'function paintShot(g, env, s, ctx) {',
    '  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));',
    '  const palm = [1000, 600];',
    paint,
    '}',
    'export function build(ctx) {',
    '  const stage = ctx.kit.fx.inkStage();',
    '  ctx.scene.add(stage);',
    '  return { stage, knock: 1.5, gone: 3.5, cuts: [{ at: 0, x: 960, y: 560, z: 1 }, { at: 1.5, x: 1100, y: 600, z: 2.4, rot: -4 }] };',
    '}',
    'export function update(t, s, ctx) {',
    '  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));',
    '}',
    '',
  ].join('\n');
}

const drifted = (name: keyof Snippets, from: string, to: string): string => {
  const code = C_CAM_VOCAB_SNIPPETS[name];
  if (!code.includes(from)) throw new Error(`snippet ${name} no longer contains ${from}`);
  return snippetScene({ ...C_CAM_VOCAB_SNIPPETS, [name]: code.replace(from, to) });
};

describe('kit-docs Grim Ink vocabulary topics', () => {
  it('has one short topic per family, reachable through kit-docs, under 28 KB together', () => {
    expect(C_CAM_VOCAB_TOPIC_NAMES).toEqual([
      'ink-props',
      'ink-things',
      'ink-instruments',
      'ink-crowd',
      'ink-acting',
      'ink-fx',
    ]);
    for (const name of C_CAM_VOCAB_TOPIC_NAMES) {
      const text = topic(name);
      expect(text.length, name).toBeLessThan(6_000);
      expect(describeKitName(CATALOG, name)).toBe(text);
    }
    const all = C_CAM_VOCAB_TOPIC_NAMES.map(topic).join('\n');
    expect(Buffer.byteLength(all, 'utf8')).toBeLessThan(28 * 1024);
    expect(describeInkVocabTopic('ink-scene')).toBeUndefined();
    expect(() => describeKitName(CATALOG, 'ink-crwd')).toThrow(/did you mean: ink-crowd/);
  });

  it("lists every entry of the kit's registries, from the prompts' one list", () => {
    const text = (family: string) =>
      family === 'props' ? topic('ink-props') + topic('ink-things') : topic(`ink-${family}`);
    for (const family of VOCAB_FAMILIES) {
      for (const name of VOCAB_NAMES[family])
        expect(text(family), `${family}.${name}`).toContain(`env.ink.${family}.${name}(`);
    }
    expect(Object.values(C_CAM_VOCAB_TOPICS)).toEqual(C_CAM_VOCAB_TOPIC_NAMES);
    const index = describeCCamTopic('grim-ink') ?? '';
    for (const name of C_CAM_VOCAB_TOPIC_NAMES) expect(index).toContain(name);
    expect(index.length).toBeLessThan(6_000);
    expect(topic('ink-acting')).toContain(C_CAM_VOCAB_SNIPPETS.acting);
  });

  it('names only namespaces and entries the stage has', () => {
    const texts = [
      ...C_CAM_VOCAB_TOPIC_NAMES.map(topic),
      ...Object.values(C_CAM_VOCAB_SNIPPETS),
    ].join('\n');
    const found = [...texts.matchAll(/env\.ink\.(props|instruments|crowd|acting|fx)\.(\w+)/g)];
    expect(found.length).toBeGreaterThan(40);
    for (const [, family = '', name = ''] of found) {
      expect(STAGE_INK_NAMES).toContain(family);
      expect(VOCAB_NAMES[family as (typeof VOCAB_FAMILIES)[number]], `${family}.${name}`).toContain(
        name,
      );
    }
  });
});

describe('Grim Ink vocabulary snippets and examples', () => {
  it('make a scene that passes the determinism lint and draws on the real kit stage', () => {
    const source = snippetScene(C_CAM_VOCAB_SNIPPETS);
    expect(lintScene(source, { filename: 'scenes/cv_snippets.js' })).toEqual([]);
    expect(run(source)).toBeGreaterThan(400);
  });

  it('would fail on a call that drifted from the vocabulary', () => {
    expect(() => run(drifted('prop', "kind: 'stand'", "kind: 'brazier'"))).toThrow(
      /props\.lamp: kind.*kit-docs ink-props/,
    );
    expect(() => run(drifted('crowd', "reaction: 'gasp'", "reaction: 'boo'"))).toThrow(
      /kit-docs ink-crowd/,
    );
    expect(() => run(drifted('acting', 'who: ctx.kit.people.clerk', 'who: null'))).toThrow(
      /who must be a person/,
    );
    expect(() => run(drifted('instrument', 'x: 980', 'x: 980, pul: 1'))).toThrow(
      /kit-docs ink-instruments/,
    );
    expect(() => run(drifted('fx', 't0: s.gone', 't0: s.gone, dur: -1'))).toThrow(
      /kit-docs ink-fx/,
    );
  });

  const files = readdirSync(VOCAB_EXAMPLES)
    .filter((file) => file.endsWith('.js'))
    .sort();

  it('has one example per family', () => {
    expect(files.map((file) => file.split('_')[0])).toEqual([
      'acting',
      'crowd',
      'fx',
      'instruments',
      'props',
    ]);
  });

  it.each(files)('%s passes the lint and repaints the stage', (file) => {
    const source = readFileSync(path.join(VOCAB_EXAMPLES, file), 'utf8');
    expect(lintScene(source, { filename: `scenes/${file}` })).toEqual([]);
    expect(run(source)).toBeGreaterThan(300);
  });
});
