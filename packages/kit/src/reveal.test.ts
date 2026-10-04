/**
 * Open-loop veils (PLAN.md#12.26): the pure reveal helpers, the voxel crate's shell and dissolve
 * steps, and the retro-ui / blueprint painters at veiled, half-revealed and revealed times.
 */
import { describe, expect, it } from 'vitest';
import { prepareBoard } from './looks/blueprint/board.js';
import { CLEAR, createCanvas } from './looks/retro-ui/canvas.js';
import { C } from './looks/retro-ui/colors.js';
import { redactedBlockParams, redactedPainter } from './looks/retro-ui/redacted.js';
import { maskedRegion, setupMasked } from './looks/blueprint/masked.js';
import { crateCell, veilShake } from './props/veil.js';
import {
  revealBayer,
  revealProgress,
  revealState,
  VEIL_STEPS,
  veilStep,
  veilStepShown,
  wipeCovered,
} from './reveal.js';
import { CRISP_PALETTE } from './testing/palettes.js';

describe('reveal helpers', () => {
  it('ramps the progress and names the state', () => {
    expect(revealProgress(0.5, 1, 0.6)).toBe(0);
    expect(revealProgress(1.3, 1, 0.6)).toBeCloseTo(0.5, 12);
    expect(revealProgress(9, 1, 0.6)).toBe(1);
    expect(revealProgress(1, 1, 0)).toBe(1);
    expect([0, 0.5, 1].map(revealState)).toEqual(['veiled', 'revealing', 'revealed']);
  });

  it('wipes everything at 1, nothing at 0, left side first in between', () => {
    let left = 0;
    let right = 0;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        expect(wipeCovered(x, y, 0.5, 0)).toBe(true);
        expect(wipeCovered(x, y, 0.5, 1)).toBe(false);
        if (!wipeCovered(x, y, 0.1, 0.4)) left += 1;
        if (!wipeCovered(x, y, 0.9, 0.4)) right += 1;
      }
    }
    expect(left).toBeGreaterThan(right);
    expect(revealBayer(0, 0)).toBeGreaterThan(0);
  });

  it('dissolves voxels top first, in VEIL_STEPS steps', () => {
    const top = veilStep(3, 15, 0, 16);
    const bottom = veilStep(3, 0, 0, 16);
    expect(top).toBeLessThan(bottom);
    expect(veilStepShown(VEIL_STEPS - 1, 0)).toBe(true);
    expect(veilStepShown(0, 1)).toBe(false);
    for (let step = 0; step < VEIL_STEPS; step += 1) expect(veilStepShown(step, 0)).toBe(true);
  });
});

describe('veiledProp crate', () => {
  const size = [16, 16, 16] as const;

  it('is a hollow shell with a frame and question marks on the sides', () => {
    expect(crateCell(8, 8, 8, size, true)).toBeUndefined();
    expect(crateCell(0, 0, 0, size, true)).toBe('frame');
    const front = Array.from({ length: 16 * 16 }, (_, index) =>
      crateCell(index % 16, Math.floor(index / 16), 15, size, true),
    );
    expect(front.filter((cell) => cell === 'mark').length).toBeGreaterThan(8);
    expect(crateCell(8, 15, 8, size, true)).toBe('panel');
    expect(
      Array.from({ length: 256 }, (_, index) =>
        crateCell(index % 16, Math.floor(index / 16), 15, size, false),
      ).includes('mark'),
    ).toBe(false);
  });

  it('trembles only in the 0.3 s before the reveal', () => {
    expect(veilShake(0.5, 1)).toBe(0);
    expect(Math.abs(veilShake(0.8, 1))).toBe(1);
    expect(veilShake(1, 1)).toBe(0);
  });
});

describe('redactedBlock painter', () => {
  const params = redactedBlockParams.parse({ text: 'PRISM', revealAt: 1, duration: 0.5 });
  const painter = redactedPainter(params);

  function blackShare(t: number): number {
    const canvas = createCanvas(painter.width, painter.height);
    const anchors = painter.paint(canvas, t);
    const [cx, cy] = anchors['block'] ?? [0, 0];
    let black = 0;
    let total = 0;
    for (let y = Math.round(cy) - 4; y < Math.round(cy) + 4; y += 1) {
      for (let x = Math.round(cx) - 20; x < Math.round(cx) + 20; x += 1) {
        total += 1;
        const value = canvas.data[y * canvas.width + x] ?? CLEAR;
        if (value === C.black || value === C.indigo) black += 1;
      }
    }
    return black / total;
  }

  it('covers the answer, lifts the bar in a dither, then shows it', () => {
    const veiled = blackShare(0.5);
    const half = blackShare(1.25);
    const revealed = blackShare(2);
    expect(veiled).toBeGreaterThan(0.95);
    expect(half).toBeLessThan(veiled);
    expect(half).toBeGreaterThan(revealed);
    expect(revealed).toBeLessThan(0.5);
  });

  it('is a pure function of t', () => {
    const first = createCanvas(painter.width, painter.height);
    const second = createCanvas(painter.width, painter.height);
    painter.paint(first, 1.2);
    painter.paint(second, 1.2);
    expect(first.data).toEqual(second.data);
  });
});

describe('maskedRegion board', () => {
  const params = maskedRegion.params.parse({ text: '1672', revealAt: 1, duration: 0.5 });
  const board = prepareBoard(CRISP_PALETTE, params, 'kit.fx.maskedRegion()', (context) =>
    setupMasked(params, context),
  );

  function count(t: number, color: number): number {
    board.render(t);
    let found = 0;
    for (let y = 0; y < board.raster.height; y += 1) {
      for (let x = 0; x < board.raster.width; x += 1) {
        if (board.raster.get(x, y) === color) found += 1;
      }
    }
    return found;
  }

  it('hides the value under the mask with a question mark, then lights it up', () => {
    const { theme } = board.context;
    expect(count(0.5, theme.hot)).toBe(0);
    expect(count(0.5, theme.accent)).toBeGreaterThan(0);
    const half = count(1.25, theme.deep);
    expect(half).toBeLessThan(count(0.5, theme.deep));
    expect(count(2, theme.hot)).toBeGreaterThan(50);
  });
});
