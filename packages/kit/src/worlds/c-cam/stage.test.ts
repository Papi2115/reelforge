/**
 * `kit.fx.inkStage` (PLAN.md#14.2) on a fake canvas: sized to the frame (or `size`), every frame
 * reset -> INK -> save -> painter -> restore, the painter gets a narrowed `Paint2D` (no canvas,
 * text, images or pixel reads) and a frozen env, bad times and painters fail clearly, dispose
 * frees the canvas (scene dispose and kit dispose).
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../../errors.js';
import type { StageCanvas } from '../../fx/ink-stage.js';
import type { Disposable } from '../../object.js';
import { C, twos } from './core.js';
import type { Paint2D } from './draw/paint.js';
import { buildInkStage, inkStage, inkStageParams, type InkStageEnv } from './stage.js';

interface FakeStage {
  readonly canvas: StageCanvas;
  readonly calls: string[];
}

/** A canvas whose 2D context records every call and property write as text. */
function fakeStage(): FakeStage {
  const calls: string[] = [];
  const state: Record<string, unknown> = {
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
  };
  const context = new Proxy(state, {
    get(target, name) {
      if (typeof name !== 'string') return undefined;
      if (name in target) return target[name];
      return (...args: unknown[]) => {
        calls.push(`${name}(${args.map(String).join(',')})`);
      };
    },
    set(target, name, value) {
      if (typeof name !== 'string') return false;
      target[name] = value;
      calls.push(`${name}=${String(value)}`);
      return true;
    },
  });
  const canvas: StageCanvas = {
    width: 0,
    height: 0,
    // The proxy answers every context member the stage and the surface use.
    getContext: () => context as unknown as CanvasRenderingContext2D,
  };
  return { canvas, calls };
}

function tools(frame?: { width: number; height: number }): {
  three: typeof THREE;
  track: <T extends Disposable>(resource: T) => T;
  frame: { width: number; height: number } | undefined;
  tracked: Disposable[];
} {
  const tracked: Disposable[] = [];
  return {
    three: THREE,
    track: (resource) => {
      tracked.push(resource);
      return resource;
    },
    frame,
    tracked,
  };
}

describe('kit.fx.inkStage', () => {
  it('is an fx with a size param and documented methods', () => {
    expect(inkStage.kind).toBe('fx');
    expect(inkStage.name).toBe('inkStage');
    expect(inkStageParams.parse({})).toEqual({});
    expect(inkStageParams.safeParse({ size: [8, 8] }).success).toBe(false);
    expect(Object.keys(inkStage.methods ?? {})).toContain('paint(t, (g, env) => ...)');
  });

  it('sizes its canvas to the frame (default 1920x1080) or to `size`', () => {
    const fake = fakeStage();
    const stage = buildInkStage({}, tools(), () => fake.canvas);
    expect([fake.canvas.width, fake.canvas.height]).toEqual([1920, 1080]);
    expect(stage.size).toEqual([1920, 1080]);
    const portrait = fakeStage();
    buildInkStage({}, tools({ width: 1080, height: 1920 }), () => portrait.canvas);
    expect([portrait.canvas.width, portrait.canvas.height]).toEqual([1080, 1920]);
    const small = fakeStage();
    expect(buildInkStage({ size: [960, 540] }, tools(), () => small.canvas).size).toEqual([
      960, 540,
    ]);
    expect(stage.kitType).toBe('inkStage');
    expect(stage.children.map((child) => child.name)).toEqual(['inkStage']);
    expect(stage.bounds().isEmpty()).toBe(true);
  });

  it('repaints from INK every frame: reset, background, save, painter, restore', () => {
    const fake = fakeStage();
    const stage = buildInkStage({}, tools(), () => fake.canvas);
    stage.paint(1.3, (g) => {
      g.fillStyle = C.RUST;
      g.fillRect(1, 2, 3, 4);
    });
    expect(fake.calls).toEqual([
      'reset()',
      `fillStyle=${C.INK}`,
      'fillRect(0,0,1920,1080)',
      'save()',
      `fillStyle=${C.RUST}`,
      'fillRect(1,2,3,4)',
      'restore()',
    ]);
  });

  it('hands the painter a Paint2D without canvas, text, images or pixel reads, and a frozen env', () => {
    const fake = fakeStage();
    const stage = buildInkStage({}, tools(), () => fake.canvas);
    let seen: { g: Paint2D; env: InkStageEnv } | undefined;
    stage.paint(2.04, (g, env) => {
      seen = { g, env };
    });
    if (seen === undefined) throw new Error('the painter did not run');
    const { g, env } = seen;
    const surface = g as unknown as Record<string, unknown>;
    for (const name of ['canvas', 'fillText', 'strokeText', 'drawImage', 'getImageData', 'filter'])
      expect(surface[name], name).toBeUndefined();
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(env)).toBe(true);
    expect(env).toMatchObject({ width: 1920, height: 1080, t: 2.04, C });
    expect(env.time.twos(env.t)).toBe(twos(2.04));
    expect(Object.keys(env.brush).sort()).toEqual(['blob', 'brushStroke', 'curve', 'inkLine']);
    expect(env).toMatchObject({ zoom: 1, lw: 1 });
    expect(Object.isFrozen(env.ink)).toBe(true);
  });

  it('draws env.ink lettering on the stage surface', () => {
    const fake = fakeStage();
    const stage = buildInkStage({}, tools(), () => fake.canvas);
    stage.paint(0, (_g, env) => {
      env.ink.drawText('OPEN', { face: 'hand', size: 40, x: 10, y: 60, seed: 1, fill: C.LINEN });
    });
    expect(fake.calls).toContain(`fillStyle=${C.LINEN}`);
    expect(fake.calls.filter((call) => call === 'fill(nonzero)').length).toBeGreaterThan(3);
  });

  it('draws the brushes through the surface', () => {
    const fake = fakeStage();
    const stage = buildInkStage({}, tools(), () => fake.canvas);
    stage.paint(0, (_g, env) => {
      env.brush.inkLine([10, 10, 200, 40, 400, 20], { seed: 3 });
      env.brush.blob([0, 0, 100, 0, 100, 100, 0, 100], env.C.CLAY, { seed: 4 });
    });
    const fills = fake.calls.filter((call) => call.startsWith('fill('));
    expect(fills.length).toBeGreaterThanOrEqual(3);
    expect(fake.calls).toContain(`fillStyle=${C.CLAY}`);
    expect(fake.calls[3]).toBe('save()');
  });

  it('rejects a non-finite t and a painter that is not a function', () => {
    const fake = fakeStage();
    const stage = buildInkStage({}, tools(), () => fake.canvas);
    expect(() => {
      stage.paint(Number.NaN, () => undefined);
    }).toThrow(KitError);
    expect(() => {
      stage.paint(Number.POSITIVE_INFINITY, () => undefined);
    }).toThrow(/finite time/);
    const notAPainter = 'draw' as unknown as () => void;
    expect(() => {
      stage.paint(1, notAPainter);
    }).toThrow(/painter must be a function/);
    expect(fake.calls).toEqual([]);
  });

  it('frees the canvas on dispose of the object and of the kit', () => {
    const fake = fakeStage();
    const stage = buildInkStage({}, tools(), () => fake.canvas);
    stage.dispose();
    expect([fake.canvas.width, fake.canvas.height]).toEqual([0, 0]);
    expect(() => {
      stage.paint(0, () => undefined);
    }).toThrow(/disposed/);
    const other = fakeStage();
    const kitTools = tools();
    buildInkStage({}, kitTools, () => other.canvas);
    for (const resource of kitTools.tracked) resource.dispose();
    expect([other.canvas.width, other.canvas.height]).toEqual([0, 0]);
  });
});
