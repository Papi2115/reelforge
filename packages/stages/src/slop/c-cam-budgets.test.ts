/**
 * PLAN.md#14.19: the Grim Ink frame budgets measured on the concept films (c-cam-labels.ts,
 * scripts/c-cam-proof-metrics.mjs) replace the general ones in that world only, and the concept
 * films' objects never leak into another film through the technique topics.
 */
import type { RgbaImage } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import { cCamShowcaseFindings, nameWords } from './c-cam-showcase.js';
import { C_CAM_FRAME_BUDGETS } from './c-cam-labels.js';
import { ELEMENT_BUDGET, slopFrameFindings } from './guards.js';
import { parseScene } from './source-text.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

/** A 1920x1080 grey frame with `count` black squares (96 px = 4 blocks) far apart. */
function squares(count: number): RgbaImage {
  const [width, height] = [1920, 1080];
  const data = new Uint8Array(width * height * 4).fill(128);
  for (let index = 0; index < count; index += 1) {
    const [x0, y0] = [120 + (index % 5) * 340, 160 + Math.floor(index / 5) * 420];
    for (let y = y0; y < y0 + 96; y += 1) {
      for (let x = x0; x < x0 + 96; x += 1)
        data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
    }
  }
  return { width, height, data };
}

const VOCABULARY = buildVocabulary(['The porter knocked twice on the boiler room door.']);
const frames = (image: RgbaImage) => [{ t: 1, image }];
const scene = { treatment: 'character-scene' as const };

describe('Grim Ink frame budgets (PLAN.md#14.19)', () => {
  it('are the measured ones in c-cam and absent in every other world', () => {
    expect(worldSlopSpec('c-cam')?.frameBudgets).toEqual({
      elements: 8,
      accentShare: 0.117,
      symmetry: 0.84,
    });
    for (const world of ['sketchbook', 'comic', 'game-b1', 'game-b2']) {
      expect(worldSlopSpec(world)?.frameBudgets).toBeUndefined();
    }
  });

  it('let a frame as dense as the densest authored one pass in c-cam only', () => {
    const dense = squares(7);
    const general = { vocabulary: VOCABULARY, spec: worldSlopSpec('comic'), accent: undefined };
    const ink = { vocabulary: VOCABULARY, spec: worldSlopSpec('c-cam'), accent: undefined };
    expect(ELEMENT_BUDGET).toBe(6);
    expect(slopFrameFindings(general, frames(dense), scene).map((f) => f.message)).toEqual([
      expect.stringMatching(/^clutter: 7 competing .*budget 6/u),
    ]);
    expect(slopFrameFindings(ink, frames(dense), scene)).toEqual([]);
    expect(slopFrameFindings(ink, frames(squares(9)), scene).map((f) => f.message)).toEqual([
      expect.stringMatching(/^clutter: 9 competing .*budget 8/u),
    ]);
    expect(C_CAM_FRAME_BUDGETS.elements).toBeGreaterThan(ELEMENT_BUDGET);
  });
});

describe('Grim Ink showcase guard (PLAN.md#14.19)', () => {
  const program = (source: string) => {
    const parsed = parseScene(source);
    if (parsed === undefined) throw new Error('does not parse');
    return parsed;
  };

  it('splits names into words and joined pairs', () => {
    expect(nameWords('drawToyBear')).toEqual(['draw', 'toy', 'bear', 'drawtoy', 'toybear']);
  });

  it('flags a concept film object the narration never asks for, once per film', () => {
    const source = `export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => {
    drawToyBear(g, env);
    ctx.kit.people.pope.draw(g, env, { t: env.t });
    const room = 'conclave';
  });
}
function drawToyBear() {}`;
    const [found, ...rest] = cCamShowcaseFindings(program(source), 's04.js', VOCABULARY);
    expect(rest).toEqual([]);
    expect(found?.message).toMatch(/unrequested showcase object: .*toy bear \(s04.js:3\)/u);
    expect(found?.message).toMatch(/papal-conclave film .*\(s04.js:4\)/u);
    expect(found?.severity).toBe('warning');
  });

  it('spares the objects the narration names and the kit gag props', () => {
    const vocabulary = buildVocabulary(['The cardinals locked the doors until a pope was chosen.']);
    const source = `export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => {
    ctx.kit.people.pope.draw(g, env, { t: env.t, gag: { kind: 'gum' }, props: { helmet: 1 } });
  });
}`;
    expect(cCamShowcaseFindings(program(source), 's04.js', vocabulary)).toEqual([]);
  });
});
