/**
 * The thrown item (PLAN.md#13.4 part b): the arc starts where the hand releases it and ends on the
 * target, the item tumbles in the air and rests (or is gone) after landing with a dust puff, the
 * hit sprite flinches and settles, the hand opens and lowers out and never comes back holding the
 * thrown item; the kit API checks the spec with readable errors; frames are a pure function of t.
 */
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { B2_TABLE } from '../palette.js';
import type { SpriteDraw } from '../ray/lighting.js';
import { flightAt, flinchOffset, throwSprites, type ThrowEvent } from './throw.js';

const EVENT: ThrowEvent = {
  windup: 0.6,
  release: 1,
  land: 1.6,
  end: 1.6,
  item: { label: 'E.T.' },
  from: [2, 2, 0.55],
  to: [5, 2, 0],
  arc: 0.3,
  stay: true,
  spin: 1,
  region: () => 0,
};

type Api = Record<string, (...args: unknown[]) => unknown>;

function view(): Api {
  const palette = Object.fromEntries(B2_TABLE.map(([, swatch, hex]) => [swatch, hex]));
  const fx: Readonly<Record<string, unknown>> = createKit({
    three: THREE,
    palette,
    rng: testRng(3),
    style: 'game-b2',
  }).api.fx;
  const make = fx['b2View'] as (params: Record<string, unknown>) => Api;
  return make({
    level: 'office',
    seed: 4,
    path: [{ at: 0, x: 18.4, y: 6.9, yaw: -64 }],
  });
}

describe('thrown items', () => {
  it('fly from the release point along an arc onto the target, then rest with dust', () => {
    expect(flightAt(EVENT, 1)).toMatchObject({ x: 2, y: 2, z: 0.55, u: 0 });
    const top = flightAt(EVENT, 1.3);
    expect(top.z).toBeGreaterThan(0.55 * 0.5 + 0.2);
    const landed = flightAt(EVENT, 2.4);
    expect(landed).toMatchObject({ x: 5, y: 2, u: 1 });
    const out: SpriteDraw[] = [];
    throwSprites([EVENT], 0.9, out);
    expect(out).toHaveLength(0);
    throwSprites([EVENT], 1.65, out);
    expect(out).toHaveLength(2);
    const gone: SpriteDraw[] = [];
    throwSprites([{ ...EVENT, stay: false }], 2.5, gone);
    expect(gone).toHaveLength(0);
  });

  it('make the hit sprite flinch along the throw and settle', () => {
    const flinches = [{ id: 'worker', at: 1, dx: 1, dy: 0 }];
    expect(flinchOffset(flinches, 'worker', 0.9)).toBeUndefined();
    const hit = flinchOffset(flinches, 'worker', 1.02);
    expect(Math.abs(hit?.dx ?? 0)).toBeGreaterThan(0.05);
    expect(flinchOffset(flinches, 'worker', 1.9)).toBeUndefined();
    expect(flinchOffset(flinches, 'other', 1.02)).toBeUndefined();
  });

  it('checks the spec: intent, a target or a landing point, an open cell', () => {
    const v = view();
    const toss = v['throw'];
    if (toss === undefined) throw new Error('view.throw is not bound');
    expect(() => toss({ kind: 'note' }, { at: 1, target: 'worker' })).toThrow(/intent/);
    // An item without its look (an icon of the film, or a note / key) is refused: no default.
    expect(() =>
      toss({ label: 'MAP' }, { intent: 'the deadline lands on the desk', at: 1, target: 'worker' }),
    ).toThrow(/item: give it the film's own look/);
    expect(() =>
      toss({ kind: 'note' }, { intent: 'the deadline lands on the desk', at: 1 }),
    ).toThrow(/exactly one of to/);
    expect(() =>
      toss({ kind: 'note' }, { intent: 'the deadline lands on the desk', at: 1, target: 'nobody' }),
    ).toThrow(/no sprite with id "nobody"/);
    expect(() =>
      toss({ kind: 'note' }, { intent: 'the deadline lands on the desk', at: 1, to: [0.5, 0.5] }),
    ).toThrow(/inside a wall or door/);
    const done = toss(
      { kind: 'note', label: 'XMAS!' },
      { intent: 'the deadline lands on the desk', at: 1, target: 'worker' },
    ) as { release: number; land: number; cues: { name: string }[] };
    expect(done.release).toBe(1);
    expect(done.land).toBeGreaterThan(1.3);
    expect(done.cues.map((cue) => cue.name)).toEqual(['whoosh', 'paper']);
  });

  it('renders the same pixels for the same t in any order', () => {
    const hashes = (order: readonly number[]): string[] => {
      const v = view();
      v['hold']?.({ kind: 'key' }, { at: -1 });
      v['throw']?.(
        { kind: 'key' },
        { intent: 'the key goes back on the desk', at: 1, target: 'worker' },
      );
      const object = v as unknown as THREE.Object3D;
      return order.map((t) => {
        v['update']?.(t);
        const mesh = object.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
        const map = mesh.material.uniforms['map']?.value as THREE.DataTexture | undefined;
        const image = map?.image as { data: Uint8Array } | undefined;
        return createHash('sha256')
          .update(image?.data ?? new Uint8Array())
          .digest('hex');
      });
    };
    const times = [0.5, 0.8, 1.05, 1.3, 1.6, 2.2];
    const forward = hashes(times);
    expect(hashes([...times].reverse()).reverse()).toEqual(forward);
    expect(new Set(forward).size).toBe(times.length);
  });
});
