/**
 * The framing helper (PLAN.md#14.17): a world subject lands on its third at the size's zoom, a
 * push keeps it there, a list of points sets the zoom from its height, bad input is a KitError,
 * and the result is a valid cut of the cut table.
 */
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { H, W } from '../core.js';
import { cutFramingAt, worldToScreen } from './camera.js';
import { cutTableSchema } from './camera-schema.js';
import { FRAMING_SIZES, FRAMING_ZOOM, frameOn } from './framing.js';

const screenOf = (cut: { x: number; y: number; z: number }, p: readonly [number, number]) =>
  worldToScreen({ x: cut.x, y: cut.y, z: cut.z, rot: 0 }, p[0], p[1]);

describe('frameOn', () => {
  it.each(FRAMING_SIZES)('puts a point on the left third at the %s zoom', (size) => {
    const palm: [number, number] = [1234, 567];
    const cut = frameOn(palm, size);
    expect(cut.z).toBeGreaterThanOrEqual(FRAMING_ZOOM[size].min);
    expect(cut.z).toBeLessThanOrEqual(FRAMING_ZOOM[size].max);
    const on = screenOf(cut, palm);
    expect(on.x).toBeCloseTo(W / 3, 6);
    expect(on.y).toBeCloseTo(H * 0.45, 6);
  });

  it('sizes a list of points by its height and places it on the chosen third', () => {
    const face: [number, number][] = [
      [900, 300],
      [905, 530],
    ];
    const cut = frameOn([...face, null], 'close', { side: 'right', height: 0.4 });
    expect(cut.z).toBeCloseTo((0.42 * H) / 230, 6);
    const centre = screenOf(cut, [902.5, 415]);
    expect(centre.x).toBeCloseTo((W * 2) / 3, 6);
    expect(centre.y).toBeCloseTo(H * 0.4, 6);
    // A tiny box is clamped to the size's tightest zoom.
    expect(
      frameOn(
        [
          [0, 0],
          [0, 10],
        ],
        'ecu',
      ).z,
    ).toBe(FRAMING_ZOOM.ecu.max);
  });

  it('pushes in on the subject and keeps it on its spot', () => {
    const coins: [number, number] = [1080, 560];
    const cut = frameOn(coins, 'ecu', { rot: 6, push: 0.15, end: 2, z: 3.2 });
    expect(cut.rot).toBe(6);
    expect(cut.to?.z).toBeCloseTo(3.2 * 1.15, 6);
    const table = cutTableSchema.parse([{ at: 0.5, ...cut }]);
    const late = cutFramingAt(table[0] ?? { at: 0, x: 0, y: 0, z: 1 }, 2);
    expect(screenOf({ ...late }, coins).x).toBeCloseTo(W / 3, 6);
    // Without an end there is no move.
    expect(frameOn(coins, 'ecu', { push: 0.2 }).to).toBeUndefined();
  });

  it('rejects what is not a subject or a size', () => {
    expect(() => frameOn({ x: 1, y: 2 }, 'close')).toThrow(KitError);
    expect(() => frameOn([], 'close')).toThrow(/world point/);
    expect(() => frameOn([1, 2], 'huge' as 'ecu')).toThrow(/size must be one of/);
  });
});
