/**
 * The one-hand invariants (hand-check.ts) over every Sketchbook example scene, the scenes of real
 * test film 2 (docs/real-run-sketchbook-2.md: ghost-writing in s01/s03, hops, two hands in s10;
 * fixtures in packages/kit/test/fixtures/sketchbook-run2 with their anchor times) and a synthetic
 * worst case: at most one hand, no ink without the nib on it (unless parallel), no hop, no flip.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { hash } from '../draw/math.js';
import type { PageApi } from './api.js';
import { checkHand, type HandViolation } from './hand-check.js';
import type { SketchPage } from './model.js';
import { sketchPageModel } from './sketch-page.js';

const KIT_ROOT = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const EXAMPLES = path.join(KIT_ROOT, 'examples', 'sketchbook');
const RUN2 = path.join(KIT_ROOT, 'test', 'fixtures', 'sketchbook-run2');

/** Shot lengths of the example scenes (as their render tests). */
const EXAMPLE_DURATIONS: Readonly<Record<string, number>> = {
  a1_quarter: 8.8,
  a2_caesar: 8.6,
  a3_gregory: 9,
  b1_maths: 9,
  b2_envelope: 8.6,
  b3_rule: 8.8,
  b4_strip: 8.5,
  c1_hook: 7,
  c2_flipbook: 6.7,
  c3_popup: 8,
};

interface Hit {
  readonly t: number;
  readonly tEnd: number;
}
interface Run2Shot {
  readonly duration: number;
  readonly anchors: Readonly<Record<string, Hit>>;
}

type Page = THREE.Group & PageApi & { update(t: number): void };
interface SceneModule {
  build(ctx: unknown): unknown;
}

const clamp = (k: number): number => Math.min(1, Math.max(0, k));
/** The engine's ctx.ease helpers the scenes use. */
const EASE = {
  smoothstep: (k: number) => clamp(k) * clamp(k) * (3 - 2 * clamp(k)),
  easeOutCubic: (k: number) => 1 - (1 - clamp(k)) ** 3,
  easeInOutCubic: (k: number) =>
    clamp(k) < 0.5 ? 4 * clamp(k) ** 3 : 1 - (-2 * clamp(k) + 2) ** 3 / 2,
  easeOutBack: (k: number) => 1 + 2.70158 * (clamp(k) - 1) ** 3 + 1.70158 * (clamp(k) - 1) ** 2,
};

function kit() {
  return createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  }).api;
}

/** Builds a scene file; returns the models of the pages it made. */
async function buildScene(file: string, duration: number, anchors: Run2Shot['anchors'] = {}) {
  const api = kit();
  const fx = api.fx as unknown as Record<string, (params: unknown) => Page>;
  const make = fx['sketchPage'];
  if (!make) throw new Error('sketchPage is not bound');
  const pages: SketchPage[] = [];
  const anchor = (phrase: string, nth = 1): Hit => {
    const hit = anchors[`${phrase}#${String(nth)}`];
    if (!hit) throw new Error(`${path.basename(file)}: no anchor "${phrase}" #${String(nth)}`);
    return hit;
  };
  const ctx = {
    kit: {
      ...api,
      fx: {
        ...fx,
        sketchPage: (params: unknown) => {
          const page = make(params);
          const model = sketchPageModel(page);
          if (model) pages.push(model);
          return page;
        },
      },
    },
    scene: { add: () => undefined },
    shot: { width: 960, height: 540, duration },
    rng: testRng(2115),
    anchor,
    sfx: { at: () => undefined },
    ease: EASE,
  };
  const scene = (await import(pathToFileURL(file).href)) as SceneModule;
  scene.build(ctx);
  return pages;
}

function summary(violations: readonly HandViolation[]): string[] {
  return violations.slice(0, 8).map((v) => `t=${v.t.toFixed(3)} ${v.rule}: ${v.detail}`);
}

describe('one hand: every example scene', () => {
  const files = readdirSync(EXAMPLES).filter((name) => name.endsWith('.js'));
  it.each(files)('%s', async (name) => {
    const duration = EXAMPLE_DURATIONS[name.replace('.js', '')] ?? 8;
    const pages = await buildScene(path.join(EXAMPLES, name), duration);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) expect(summary(checkHand(page, 0, duration))).toEqual([]);
  });
});

describe('one hand: real test film 2 (Dancing Plague)', () => {
  const shots = JSON.parse(readFileSync(path.join(RUN2, 'anchors.json'), 'utf8')) as Readonly<
    Record<string, Run2Shot>
  >;
  /** The scenes as Claude wrote them; s07 in its toolkit rewrite (the original is rejected). */
  const files = readdirSync(RUN2).filter(
    (name) => name.endsWith('.js') && name !== 's07_popup_stage.js',
  );
  it.each(files)('%s', async (name) => {
    const shot = shots[name.replace(/(_v2)?\.js$/, '')];
    if (!shot) throw new Error(name);
    const pages = await buildScene(path.join(RUN2, name), shot.duration, shot.anchors);
    for (const page of pages) expect(summary(checkHand(page, 0, shot.duration))).toEqual([]);
  });

  it('rejects the original s07 pop-up (no intent, a meaningless disc swung by the pull)', async () => {
    const shot = shots['s07_popup_stage'];
    if (!shot) throw new Error('s07');
    await expect(
      buildScene(path.join(RUN2, 's07_popup_stage.js'), shot.duration, shot.anchors),
    ).rejects.toThrow(/intent/);
  });
});

describe('one hand: synthetic worst case', () => {
  /** Many marks far apart, overlapping in time, in every kind (seeded, the same every run). */
  function chaos(seed: number, hero: boolean): Page {
    const page = kit().fx as unknown as Record<string, (params: unknown) => Page>;
    const make = page['sketchPage'];
    if (!make) throw new Error('sketchPage is not bound');
    const target = make({ size: [960, 540], seed, duration: 6 });
    const r = (k: number, salt: number): number => hash(seed, k, salt);
    for (let k = 0; k < 18; k += 1) {
      const [x, y, at] = [60 + r(k, 1) * 760, 60 + r(k, 2) * 420, r(k, 3) * 4.5];
      const kind = Math.floor(r(k, 4) * 6);
      if (kind === 0) target.write('LABEL', { x, y, size: 16 + r(k, 5) * 30, at });
      else if (kind === 1) target.figure({ x, y: Math.max(y, 200), h: 120, at });
      else if (kind === 2) target.stroke([x, y, x + 200 * r(k, 6), y + 90 * r(k, 7)], { at });
      else if (kind === 3) target.loop(x, y, 40, 30, { at, tool: 'red' });
      else if (kind === 4) target.write('NOTE', { x, y, size: 14, at, parallel: true });
      else target.fill([x, y, x + 60, y, x + 60, y + 40, x, y + 40], { at });
    }
    target.write('HERO 400', { x: 300, y: 300, size: 90, hand: 'marker', at: 2, hero });
    return target;
  }

  it.each([
    [7, false],
    [8, true],
    [9, false],
    [10, true],
  ])('seed %i (explicit hero %s): one hand, no ghost ink, no hop, no flip', (seed, hero) => {
    const target = chaos(seed, hero);
    const model = sketchPageModel(target);
    if (!model) throw new Error('no page model');
    expect(summary(checkHand(model, 0, 6))).toEqual([]);
  });

  it('keeps the hero on its time with the hand on it', () => {
    const model = sketchPageModel(chaos(8, true));
    if (!model) throw new Error('no page model');
    const hero = model.probe(2.15).drawing.find((ink) => ink.tip[1] > 180 && ink.tip[1] < 320);
    expect(hero).toBeDefined();
    const pen = model.probe(2.15).pen;
    expect(pen && hero && Math.hypot(pen.x - hero.tip[0], pen.y - hero.tip[1])).toBeLessThan(5);
  });
});
