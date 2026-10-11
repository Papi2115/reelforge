/**
 * `env.ink` of the Grim Ink stage (PLAN.md#14.12): the kit's draw functions as scenes call them,
 * the checked entry points (cut tables, poses, expressions, lettering options) failing with a fix,
 * person handles accepted where the rig wants its character, and the lettering drawn as ribbons on
 * the frame's surface (an open stroke one ring, a closed one two rings, both `nonzero`).
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KitError } from '../../errors.js';
import { DEFAULT_ENV } from './draw/brushes.js';
import { applyCamera, resolveCut } from './draw/camera.js';
import { palmWorld } from './draw/contact.js';
import { pose } from './draw/poses.js';
import { RecordingPaint } from './draw/recording-paint.js';
import { paintInkSurface } from './lettering/paint-surface.js';
import { personFromModule } from './modules/person.js';
import { STAGE_INK_NAMES, stageInk } from './stage-ink.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', 'examples', 'c-cam');

async function baker() {
  const file = pathToFileURL(path.join(EXAMPLES, 'people', 'nightBaker.js')).href;
  return personFromModule(await import(file), 'kit-ext/people/nightBaker.js');
}

const CUTS = [
  { at: 0, x: 960, y: 540, z: 1 },
  { at: 1, x: 900, y: 500, z: 2.4, rot: -4 },
];

const ops = (paint: RecordingPaint, op: string): number =>
  paint.calls.filter((call) => call.op === op).length;

describe('env.ink', () => {
  it('binds the camera, scenery, grime, faces, rig, contacts and lettering', () => {
    const ink = stageInk(new RecordingPaint());
    expect(Object.isFrozen(ink)).toBe(true);
    for (const name of [
      'applyCamera',
      'resolveCut',
      'fgScreen',
      'fgWorld',
      'silhouette',
      'coverage',
      'blob',
      'inkLine',
      'pool',
      'stain',
      'crack',
      'exprAt',
      'face',
      'hand',
      'pose',
      'drawFigure',
      'palmWorld',
      'reachPalm',
      'figToWorld',
      'bowPt',
      'solvePose',
      'anchors',
      'drawText',
      'posterLayers',
      'thudScale',
    ]) {
      expect(STAGE_INK_NAMES, name).toContain(name);
      expect(typeof (ink as Readonly<Record<string, unknown>>)[name], name).not.toBe('undefined');
    }
    expect(STAGE_INK_NAMES).toEqual([...Object.keys(ink)].sort());
  });

  it('resolves a checked cut table exactly like the camera module', () => {
    const ink = stageInk(new RecordingPaint());
    expect(ink.resolveCut(CUTS, 1.5)).toEqual(resolveCut(CUTS, 1.5));
    const g = new RecordingPaint();
    expect(ink.applyCamera(g, ink.resolveCut(CUTS, 1.5)).env).toEqual(
      applyCamera(new RecordingPaint(), resolveCut(CUTS, 1.5)).env,
    );
    expect(ink.coverage(CUTS)).toEqual([]);
    expect(() => ink.resolveCut([{ at: 0, x: 0, y: 0, z: 9 }], 0)).toThrow(KitError);
    expect(() => ink.resolveCut([...CUTS].reverse(), 0)).toThrow(/strictly ascending/);
    expect(() => ink.coverage([])).toThrow(/kit-docs ink-camera/);
  });

  it('names the fix for an unknown pose, expression or lettering face', () => {
    const ink = stageInk(new RecordingPaint());
    const D = { sw: 50, sy: -600, sz: 6, l1a: 128, l2a: 118, hw: 28, hy: -372, l1l: 186 };
    const dims = { ...D, l2l: 168, waist: [62, -440] as const, hsz: 34 };
    expect(ink.pose('point', dims, -1)).toEqual(pose('point', dims, -1));
    expect(() => ink.pose('dance' as 'stand', dims)).toThrow(/unknown pose "dance"; one of stand/);
    expect(
      ink.exprAt(
        [
          [0, 'deadpan'],
          [2, 'shock'],
        ],
        2.1,
      ),
    ).toBe('shock');
    expect(() => ink.exprAt([[0, 'smirk' as 'grin']], 0)).toThrow(/unknown expression "smirk"/);
    const text = { face: 'hand', size: 40, x: 0, y: 0, seed: 1, fill: '#000' } as const;
    expect(() => ink.drawText('A', { ...text, face: 'serif' as 'hand' })).toThrow(/face must be/);
    expect(() => ink.drawText('A', { ...text, size: Number.NaN })).toThrow(/size must be/);
    expect(() => ink.drawText(7 as unknown as string, text)).toThrow(/text must be a string/);
  });

  it('takes a person handle wherever the rig wants a character', async () => {
    const person = await baker();
    const ink = stageInk(new RecordingPaint());
    const fig = {
      character: person,
      placement: { x: 900, y: 930, s: 0.9, yaw: 1 },
      pose: person.pose('stand'),
    };
    expect(ink.palmWorld(fig, 'R')).toEqual(
      palmWorld({ ...fig, character: person.character }, 'R'),
    );
    const goal = [840, 560] as const;
    const hR = ink.reachPalm(fig, 'R', goal);
    const reached = ink.palmWorld({ ...fig, pose: { ...fig.pose, hR } }, 'R');
    expect(Math.hypot(reached[0] - goal[0], reached[1] - goal[1])).toBeLessThan(2);
    expect(ink.anchorWorld(fig, 'chin')).not.toBeNull();
    const g = new RecordingPaint();
    const joints = ink.drawFigure(g, DEFAULT_ENV, person, fig.placement, fig.pose, 1, 'shock', 0);
    expect(joints.aR).toBeDefined();
    expect(ops(g, 'fill')).toBeGreaterThan(20);
    expect(() =>
      ink.drawFigure(g, DEFAULT_ENV, null as never, fig.placement, fig.pose, 1, undefined, 0),
    ).toThrow(/character must be a person/);
  });

  it('draws lettering as ink ribbons on the frame surface', () => {
    const g = new RecordingPaint();
    const laid = stageInk(g).drawText('OPEN', {
      face: 'hand',
      size: 50,
      x: 100,
      y: 200,
      seed: 3,
      fill: '#16120e',
    });
    expect(laid.strokes.length).toBeGreaterThan(4);
    expect(ops(g, 'fill')).toBe(laid.strokes.length);
    expect(
      g.calls.filter((call) => call.op === 'fill').every((call) => call.args[0] === 'nonzero'),
    ).toBe(true);
    expect(g.calls).toContainEqual({ op: 'set:fillStyle', args: ['#16120e'] });
  });

  it('closes an open ribbon once and a closed one as two rings', () => {
    const open = new RecordingPaint();
    paintInkSurface(open).ribbon(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
      [2, 4, 2],
      '#111',
    );
    expect([ops(open, 'moveTo'), ops(open, 'lineTo'), ops(open, 'closePath')]).toEqual([1, 5, 1]);
    const ring = new RecordingPaint();
    const loop = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 0 },
    ];
    paintInkSurface(ring).ribbon(loop, [2, 2, 2, 2, 2], '#111');
    expect([ops(ring, 'moveTo'), ops(ring, 'closePath'), ops(ring, 'fill')]).toEqual([2, 2, 1]);
    const dot = new RecordingPaint();
    paintInkSurface(dot).ribbon([{ x: 0, y: 0 }], [3], '#111');
    expect(dot.calls).toEqual([]);
  });
});
