/**
 * The Grim Ink (c-cam) anti-slop hooks (PLAN.md#14.10): its human traces are read from the scene
 * API's member calls and options, its ink lettering is on-screen text, and the labels of signs,
 * stamps and ledgers are not "invented text". Calibration (PLAN.md#14.12): no finding on the kit's
 * c-cam example scene, the world's look goldens and the frames of its place goldens.
 */
import { resolveStyle } from '@reelforge/engine';
import type { RgbaImage } from '@reelforge/engine/raster';
import { describe, expect, it } from 'vitest';
import {
  C_CAM_LOOK_GOLDENS,
  C_CAM_NARRATION,
  C_CAM_SHEET_GOLDENS,
  cCamExampleScenes,
} from '../testing/c-cam-slop-fixtures.js';
import { goldenFrames } from '../testing/slop-fixtures.js';
import { parseHex } from './frame-guards.js';
import { sameCompositionFindings, slopFrameFindings, slopSourceFindings } from './guards.js';
import { countTraces, MIN_HUMAN_TRACES } from './source-guards.js';
import { onScreenTexts, parseScene } from './source-text.js';
import { inventedTexts } from './text-provenance.js';
import { buildVocabulary } from './vocabulary.js';
import { worldSlopSpec } from './world-labels.js';

const SPEC = worldSlopSpec('c-cam');
if (SPEC === undefined) throw new Error('no c-cam spec');

/** A scene in the world's API on a neutral topic (a night porter and a locked door). */
const SCENE = `// focal: the locked door | cast: porter | place: corridor | traces: stain, crack, jolt
export const meta = { id: 's05_locked', title: 'Locked', treatment: 'character-scene' };
function paintShot(g, env, s, ctx) {
  const cam = env.ink.applyCamera(g, env.ink.resolveCut(s.cuts, env.t));
  ctx.kit.places.corridor.draw(g, cam.env, env.t);
  env.ink.stain(g, cam.env, 1420, 300, 90, 140, 31);
  env.ink.crack(g, cam.env, 300, 220, 120, 32);
  env.ink.stain(g, cam.env, 400, 260, 60, 90, 33);
  ctx.kit.people.porter.draw(g, cam.env, { x: 1240, y: 930, s: 0.9, view: 'profile', expr: env.ink.exprAt([[0, 'deadpan'], [s.knock, 'shock']], env.t), headDy: env.t > s.knock && env.t < s.knock + 0.2 ? -14 : 0, t: env.t });
  env.ink.drawText('CLOSED', { face: 'hand', size: 54, x: 1310, y: 380, seed: 12, fill: env.C.INK, rot: -3 });
  env.ink.drawText('NO KEY FITS', { face: 'poster', size: 120, x: 960, y: 520, seed: 7, fill: env.C.EYE });
}
export function build(ctx) {
  const stage = ctx.kit.fx.inkStage();
  ctx.scene.add(stage);
  const s = { stage, knock: ctx.anchor('knocked twice').t };
  s.cuts = [{ at: 0, x: 960, y: 560, z: 1 }, { at: s.knock, x: 1420, y: 610, z: 3.4, rot: -4 }];
  return s;
}
export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => paintShot(g, env, s, ctx));
}`;

function program(source: string) {
  const parsed = parseScene(source);
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

describe('Grim Ink anti-slop hooks', () => {
  it('counts the authored traces of the scene API, each helper within its cap', () => {
    const count = countTraces(program(SCENE), SPEC);
    expect(count.total).toBeGreaterThanOrEqual(MIN_HUMAN_TRACES);
    expect(count.found.get('stain')).toBe(2);
    expect(count.found.get('crack')).toBe(1);
    expect(count.found.get('exprAt')).toBe(1);
    expect([...count.found.keys()]).toEqual(
      expect.arrayContaining(['headDy (a head jolt)', expect.stringMatching(/^rot \(/)]),
    );
  });

  it('never counts a local helper that shares a trace name', () => {
    const local = `function stain() {}
function crack() {}
export function update(t, s) { stain(); crack(); }`;
    expect(countTraces(program(local), SPEC).total).toBe(0);
  });

  it('reads the ink lettering as on-screen text and spares the labels of signs', () => {
    const texts = onScreenTexts(program(SCENE), SPEC).map((entry) => entry.text);
    expect(texts).toEqual(expect.arrayContaining(['CLOSED', 'NO KEY FITS']));
    const vocabulary = buildVocabulary(['The porter knocked twice. The door stayed shut.']);
    const invented = inventedTexts(onScreenTexts(program(SCENE), SPEC), vocabulary, SPEC).map(
      (entry) => entry.text,
    );
    expect(invented).not.toContain('CLOSED');
    expect(invented).toContain('NO KEY FITS');
  });
});

const VOCABULARY = buildVocabulary([C_CAM_NARRATION]);
const ACCENT = parseHex(resolveStyle({ style: 'c-cam' }).palette.accent1);
const SETUP = { vocabulary: VOCABULARY, spec: SPEC, accent: ACCENT };
const EXAMPLES = cCamExampleScenes();
const LOOK_GOLDENS = [...goldenFrames(C_CAM_LOOK_GOLDENS)];
const SHEETS = [...goldenFrames(C_CAM_SHEET_GOLDENS)];

/** The three frames (wide, medium, close) a place golden stacks, top to bottom. */
function placeFrames(image: RgbaImage): RgbaImage[] {
  const height = image.height / 3;
  const size = image.width * height * 4;
  return [0, 1, 2].map((index) => ({
    width: image.width,
    height,
    data: image.data.slice(index * size, (index + 1) * size),
  }));
}

describe('Grim Ink calibration on the kit examples (PLAN.md#14.12)', () => {
  it('has the examples and goldens it judges', () => {
    expect([...EXAMPLES.keys()].sort()).toEqual(['s0_stage.js', 's1_person_place.js']);
    expect(LOOK_GOLDENS).toHaveLength(6);
    expect(SHEETS.filter(([name]) => name.startsWith('ccam-apollo-place-'))).toHaveLength(9);
  });

  it('reports nothing on the person-in-a-place example', () => {
    const source = EXAMPLES.get('s1_person_place.js') ?? '';
    expect(slopSourceFindings(SETUP, source, 's1_person_place.js')).toEqual([]);
  });

  it('flags the bare stage skeleton only for its missing human traces', () => {
    // s0 is the 14.2 skeleton (the ink stage alone, no grime, people or camera): a film shot like
    // it has no human trace, so the finding is right; nothing else is reported.
    const source = EXAMPLES.get('s0_stage.js') ?? '';
    const messages = slopSourceFindings(SETUP, source, 's0_stage.js').map((f) => f.message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/^too few human traces in s0_stage.js: 0/u);
  });

  it('counts a gag and a place foreground once, and spares the words of signs and stamps', () => {
    const scene = `export function update(t, s, ctx) {
  s.stage.paint(t, (g, env) => {
    ctx.kit.places.office.foreground(g, env, env.t);
    ctx.kit.places.office.foreground(g, env, env.t);
    ctx.kit.people.clerk.draw(g, env, { x: 1, y: 2, gag: { kind: 'sweat' }, t: env.t });
    env.ink.drawText('PAID', { face: 'hand', size: 40, x: 1, y: 2, seed: 1 });
    env.ink.drawText('NO SMOKING', { face: 'hand', size: 40, x: 1, y: 2, seed: 2 });
    env.ink.drawText('TOTAL DUE', { face: 'hand', size: 40, x: 1, y: 2, seed: 3 });
  });
}`;
    const count = countTraces(program(scene), SPEC);
    expect(count.found.get('foreground')).toBe(2);
    expect(count.found.get('gag (a micro-acting gag)')).toBe(1);
    expect(count.total).toBe(2);
    expect(inventedTexts(onScreenTexts(program(scene), SPEC), VOCABULARY, SPEC)).toEqual([]);
  });
});

describe('Grim Ink calibration on the goldens (PLAN.md#14.12)', () => {
  it('finds no clutter, accent flood or centred symmetry on the look goldens', () => {
    const flagged = LOOK_GOLDENS.flatMap(([name, image]) =>
      slopFrameFindings(SETUP, [{ t: 1, image }], { treatment: 'character-scene' }).map(
        (entry) => `${name}: ${entry.message}`,
      ),
    );
    expect(flagged).toEqual([]);
  });

  it('finds nothing on the wide, medium and close frames of every place golden', () => {
    // The sheet's medium framing is centred on the place's light by construction (a check of the
    // light pool, never a composed shot), so the symmetry guard does not judge it.
    const centredOnLight = (index: number, message: string): boolean =>
      index === 1 && message.startsWith('centred and symmetric');
    const places = SHEETS.filter(([name]) => name.startsWith('ccam-apollo-place-'));
    const flagged = places.flatMap(([name, image]) =>
      placeFrames(image).flatMap((frame, index) =>
        slopFrameFindings(SETUP, [{ t: 1, image: frame }], { treatment: 'map' })
          .filter((entry) => !centredOnLight(index, entry.message))
          .map((entry) => `${name}#${String(index)}: ${entry.message}`),
      ),
    );
    expect(flagged).toEqual([]);
  });

  it('finds no accent flood or centred symmetry on the contact sheets', () => {
    // People, faces, rig and acting sheets show several figures side by side by design (never a
    // film frame), so the clutter budget does not apply to them; the other guards still do.
    const flagged = SHEETS.flatMap(([name, image]) =>
      slopFrameFindings(SETUP, [{ t: 1, image }], { treatment: 'map' })
        .filter((entry) => !entry.message.startsWith('clutter:'))
        .map((entry) => `${name}: ${entry.message}`),
    );
    expect(flagged).toEqual([]);
  });

  it('never calls two different ink scenes the same composition', () => {
    const keys = LOOK_GOLDENS.map(([name, image]) => ({
      shot: { id: name },
      frame: { t: 1, image },
    }));
    const scene = (name: string | undefined): string => (name ?? '').replace(/-t[\d.]+\.png$/u, '');
    const flagged = [...sameCompositionFindings(keys).keys()].filter((id) => {
      const index = LOOK_GOLDENS.findIndex(([name]) => name === id);
      return scene(LOOK_GOLDENS[index - 1]?.[0]) !== scene(id);
    });
    expect(flagged).toEqual([]);
  });
});
