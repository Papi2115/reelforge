/**
 * The Grim Ink (c-cam) anti-slop hooks (PLAN.md#14.10): its human traces are read from the scene
 * API's member calls and options, its ink lettering is on-screen text, and the labels of signs
 * and stamps are not "invented text". Not wired yet; calibration on real frames is PLAN.md#14.12.
 */
import { describe, expect, it } from 'vitest';
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
