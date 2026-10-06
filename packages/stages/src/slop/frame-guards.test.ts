import { resolveStyle } from '@reelforge/engine';
import { describe, expect, it } from 'vitest';
import {
  blankFrame,
  goldenFrames,
  INK,
  mirrorLeftHalf,
  paintDisc,
  paintRect,
  PAPER,
  shiftRight,
} from '../testing/slop-fixtures.js';
import { compositionSignature, frameMetrics, parseHex, signatureDistance } from './frame-guards.js';
import { sameCompositionFindings, slopFrameFindings, type AntiSlopSetup } from './guards.js';
import { buildVocabulary } from './vocabulary.js';

const SKETCHBOOK_ACCENT = parseHex(resolveStyle({ style: 'sketchbook' }).palette.accent1);
const VOXEL_ACCENT = parseHex(resolveStyle({ style: 'voxel-pixel-crisp640' }).palette.accent1);
/** Approved frames: Sketchbook A/B/C, pop-up and strip (look-sketch-*) and voxel goldens. */
const SKETCHBOOK = goldenFrames(/^look-sketch-.*\.png$/);
const VOXEL = goldenFrames(
  /^(kit-voxel-demo-t0|kit-voxel-demo-t2\.5|kit-env-room-t0|kit-voxel-stress-t3)\.png$/,
);

const setup = (accent: AntiSlopSetup['accent']): AntiSlopSetup => ({
  vocabulary: buildVocabulary([]),
  spec: undefined,
  accent,
});

describe('frame guards on approved frames', () => {
  it('has the goldens it judges', () => {
    expect(SKETCHBOOK.size).toBe(30);
    expect(VOXEL.size).toBe(4);
  });

  it('finds nothing on any Sketchbook golden (looks A/B/C, pop-up, strip)', () => {
    const flagged = [...SKETCHBOOK].filter(
      ([, image]) =>
        slopFrameFindings(setup(SKETCHBOOK_ACCENT), [{ t: 1, image }], { treatment: 'map' })
          .length > 0,
    );
    expect(flagged.map(([name]) => name)).toEqual([]);
  });

  it('finds nothing on the voxel goldens', () => {
    const flagged = [...VOXEL].filter(
      ([, image]) =>
        slopFrameFindings(setup(VOXEL_ACCENT), [{ t: 1, image }], { treatment: 'map' }).length > 0,
    );
    expect(flagged.map(([name]) => name)).toEqual([]);
  });

  it('never calls two different Sketchbook scenes the same composition', () => {
    const scenes = [...SKETCHBOOK];
    const keys = scenes.map(([name, image]) => ({
      shot: { id: name },
      frame: { t: 1, image },
    }));
    const flagged = [...sameCompositionFindings(keys).keys()].filter((id) => {
      const index = scenes.findIndex(([name]) => name === id);
      const scene = (name: string | undefined): string =>
        (name ?? '').replace(/-t[\d.]+\.png$/, '');
      return scene(scenes[index - 1]?.[0]) !== scene(id);
    });
    expect(flagged).toEqual([]);
  });
});

describe('frame metrics', () => {
  it('counts scattered high-contrast elements', () => {
    const frame = blankFrame(960, 540, PAPER);
    for (let index = 0; index < 10; index += 1) {
      paintRect(frame, 80 + (index % 5) * 170, 100 + Math.floor(index / 5) * 220, 40, 40, INK);
    }
    expect(frameMetrics(frame, SKETCHBOOK_ACCENT).competing).toBe(10);
  });

  it('measures the accent share', () => {
    const frame = paintRect(blankFrame(100, 100, PAPER), 0, 0, 100, 20, [0xd8, 0x34, 0x2b]);
    expect(frameMetrics(frame, SKETCHBOOK_ACCENT).accentShare).toBeCloseTo(0.2, 5);
    expect(frameMetrics(frame, undefined).accentShare).toBe(0);
  });

  it('sees a mirrored layout with a centred hero, ignoring the binding at the edge', () => {
    const frame = paintRect(blankFrame(960, 540, PAPER), 0, 0, 36, 540, INK);
    paintDisc(frame, 480, 270, 110, INK);
    const metrics = frameMetrics(frame, undefined);
    expect(metrics.mirror).toBeGreaterThan(0.85);
    expect(metrics.centroidOffset).toBeLessThan(0.01);
    expect(metrics.heroOffset).toBeLessThan(0.01);
  });

  it('gives a frame and itself distance 0 and a flat page distance 1', () => {
    const [image] = SKETCHBOOK.values();
    if (image === undefined) throw new Error('no golden');
    const signature = compositionSignature(image);
    expect(signatureDistance(signature, signature)).toBe(0);
    const flat = compositionSignature(blankFrame(960, 540, PAPER));
    expect(signatureDistance(flat, flat)).toBe(1);
    expect(signatureDistance(signature, compositionSignature(shiftRight(image, 3)))).toBeLessThan(
      0.2,
    );
    expect(frameMetrics(mirrorLeftHalf(image), undefined).mirror).toBeGreaterThan(0.95);
  });
});
