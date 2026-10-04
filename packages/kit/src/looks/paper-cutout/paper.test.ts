import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CRISP_PALETTE, TOKENS_ONLY_PALETTE } from '../../testing/palettes.js';
import { CLEAR, createColors, PAPER_ROLES, toLab, type PaperRole } from './colors.js';
import { createCompositor, shadowShape } from './compositor.js';
import { entranceOffset } from './labels.js';
import { finishPaper, tearPolygon } from './paper.js';
import { stopMotion } from './piece.js';
import { poseLimbs, PUPPET_POSES } from './puppet.js';
import { createSprite, fillPolygon, fillRect, type Sprite } from './sprite.js';
import { MID_LAYER, STAGE_DISTANCE, stageGeometry } from './stage.js';

function hexOf(
  colors: ReturnType<typeof createColors>,
  index: number,
): readonly [number, number, number] {
  const offset = index * 4;
  return [colors.rgba[offset] ?? 0, colors.rgba[offset + 1] ?? 0, colors.rgba[offset + 2] ?? 0];
}

function solid(width: number, height: number, color: number): Sprite {
  const sprite = createSprite(width, height);
  sprite.data.fill(color);
  return sprite;
}

describe('paper colours', () => {
  it.each([
    ['Crisp 640', CRISP_PALETTE],
    ['tokens only', TOKENS_ONLY_PALETTE],
  ])('resolves every role and maps shade darker / light lighter (%s)', (_label, palette) => {
    const colors = createColors(palette);
    for (const role of Object.keys(PAPER_ROLES) as PaperRole[]) {
      expect(colors.role(role)).toBeGreaterThan(CLEAR);
    }
    for (let index = 1; index < colors.rgba.length / 4; index += 1) {
      const lightness = toLab(hexOf(colors, index))[0];
      const shade = colors.shade[index] ?? index;
      const light = colors.light[index] ?? index;
      if (shade !== index) expect(toLab(hexOf(colors, shade))[0]).toBeLessThan(lightness);
      if (light !== index) expect(toLab(hexOf(colors, light))[0]).toBeGreaterThan(lightness);
    }
  });

  it('keeps the hand-tuned Crisp shades and maps unknown hex to the nearest palette colour', () => {
    const colors = createColors(CRISP_PALETTE);
    expect(colors.shade[colors.index('cream')]).toBe(colors.index('tan'));
    expect(colors.shade[colors.index('brightTeal')]).toBe(colors.index('slateBlue'));
    expect(colors.hex('#f4e9d9')).toBe(colors.index('cream'));
    expect(colors.index('paper')).toBe(colors.index('cream'));
  });
});

describe('paper finish', () => {
  it('puts a light rim on the top edge of a cut piece and leaves the interior flat', () => {
    const colors = createColors(CRISP_PALETTE);
    const tone = colors.index('orange');
    const sprite = createSprite(12, 8);
    fillRect(sprite, 2, 2, 8, 5, tone);
    finishPaper(sprite, colors, { rim: 'cut', grain: 0, seed: 1 });
    expect(sprite.data[2 * 12 + 4]).toBe(colors.light[tone]);
    expect(sprite.data[4 * 12 + 4]).toBe(tone);
    expect(sprite.data[0]).toBe(CLEAR);
  });

  it('tears polygon edges deterministically and keeps the corners', () => {
    const square = [
      [0, 0],
      [40, 0],
      [40, 40],
      [0, 40],
    ] as const;
    const torn = tearPolygon(square, 2, 7);
    expect(torn).toEqual(tearPolygon(square, 2, 7));
    expect(torn).not.toEqual(tearPolygon(square, 2, 8));
    expect(torn.length).toBeGreaterThan(16);
    expect(torn[0]).toEqual([0, 0]);
  });
});

describe('compositor', () => {
  const colors = createColors(CRISP_PALETTE);
  const sky = colors.index('teal');
  const piece = colors.index('orange');

  it('pastes back to front and darkens what lies under the shadow', () => {
    const compositor = createCompositor(40, 30, colors, shadowShape(1, 1, 'high'));
    compositor.compose(sky, [
      { sprite: solid(40, 30, sky), x: 0, y: 0, layer: 0, shadow: false },
      { sprite: solid(8, 8, piece), x: 10, y: 10, layer: 1 },
    ]);
    const at = (x: number, y: number): number => compositor.data[y * 40 + x] ?? CLEAR;
    expect(at(12, 12)).toBe(piece);
    // `high` light, gap 1: the shadow falls 1 px right and 3 px down.
    const [ox, oy] = shadowShape(1, 1, 'high').offsets[1] ?? [0, 0];
    expect([ox, oy]).toEqual([1, 3]);
    expect(at(10 + 8 + ox - 1, 10 + 8 + oy - 1)).toBe(colors.shade[sky]);
    expect(at(2, 2)).toBe(sky);
    expect(compositor.layers[12 * 40 + 12]).toBe(2);
  });

  it('lifts shadows above the layer edge with a low light, longer over a deeper gap', () => {
    const shape = shadowShape(1, 1, 'low');
    expect(shape.offsets[1]?.[1]).toBeLessThan(0);
    expect(Math.abs(shape.offsets[3]?.[1] ?? 0)).toBeGreaterThan(
      Math.abs(shape.offsets[1]?.[1] ?? 0),
    );
    expect(shadowShape(0, 1, 'low').offsets.every(([x, y]) => x === 0 && y === 0)).toBe(true);
  });

  it('stacks the shadows of two pieces (a shade of a shade)', () => {
    const compositor = createCompositor(40, 30, colors, shadowShape(1, 1, 'high'));
    compositor.compose(sky, [
      { sprite: solid(40, 30, sky), x: 0, y: 0, layer: 0, shadow: false },
      { sprite: solid(6, 6, piece), x: 10, y: 6, layer: 1 },
      { sprite: solid(6, 6, piece), x: 10, y: 6, layer: 2 },
    ]);
    const below = compositor.data[(6 + 6 + 1) * 40 + 13] ?? CLEAR;
    expect([colors.shade[sky], colors.shade[colors.shade[sky] ?? sky]]).toContain(below);
  });

  it('writes palette RGBA only', () => {
    const compositor = createCompositor(4, 4, colors, shadowShape(1, 1));
    compositor.compose(sky, []);
    const rgba = new Uint8Array(4 * 4 * 4);
    compositor.writeRgba(rgba);
    expect([...rgba.subarray(0, 4)]).toEqual([...colors.rgba.subarray(sky * 4, sky * 4 + 4)]);
  });
});

describe('stage geometry', () => {
  it('draws every layer 1:1 under the preset camera and parallaxes near layers more', () => {
    const geometry = stageGeometry(640, 360, 1);
    const camera = new THREE.PerspectiveCamera(30, 640 / 360, 0.1, 1000);
    const shoot = (pan: number, layer: number, x: number, y: number): readonly [number, number] => {
      const pose = geometry.camera(pan, 0);
      camera.position.set(...pose.position);
      camera.lookAt(...pose.target);
      camera.updateMatrixWorld();
      const point = new THREE.Vector3(...geometry.point(layer, x, y)).project(camera);
      return [((point.x + 1) / 2) * 640, ((1 - point.y) / 2) * 360];
    };
    for (const layer of [0, 1, 3, 5]) {
      const [x, y] = shoot(0, layer, 100, 250);
      expect(x).toBeCloseTo(100, 6);
      expect(y).toBeCloseTo(250, 6);
    }
    expect(shoot(20, MID_LAYER, 300, 100)[0]).toBeCloseTo(280, 6);
    const near = 300 - shoot(20, 5, 300, 100)[0];
    const far = 300 - shoot(20, 1, 300, 100)[0];
    expect(near).toBeGreaterThan(20);
    expect(far).toBeLessThan(20);
    expect(geometry.depth(MID_LAYER)).toBe(0);
    expect(geometry.camera(0, 0).position[2]).toBe(STAGE_DISTANCE);
    expect(stageGeometry(640, 360, 0).depth(5)).toBe(0);
  });
});

describe('stop-motion', () => {
  it('snaps time to frames of the clock and jitters by whole pixels', () => {
    const clock = stopMotion(8, 1, 3);
    expect(clock.frame(1.0)).toBe(8);
    expect(clock.frame(1.124)).toBe(8);
    expect(clock.frame(1.125)).toBe(9);
    expect(clock.time(1.1)).toBe(1);
    for (let frame = 0; frame < 50; frame += 1) {
      const jitter = clock.jitter(frame, 2, 1);
      expect(Number.isInteger(jitter)).toBe(true);
      expect(Math.abs(jitter)).toBeLessThanOrEqual(1);
    }
    expect(stopMotion(8, 0, 3).jitter(5, 1, 2)).toBe(0);
    expect(stopMotion(12, 1, 3).frame(1.0)).toBe(12);
  });

  it('poses every puppet pose as a pure function of time', () => {
    for (const pose of PUPPET_POSES) expect(poseLimbs(pose, 1.25)).toEqual(poseLimbs(pose, 1.25));
    expect(poseLimbs('walk', 0.25).frontLeg).not.toBe(poseLimbs('walk', 0.5).frontLeg);
    expect(poseLimbs('wave', 0).frontArm).toBeGreaterThan(120);
  });

  it('brings lettered pieces in and lands them exactly', () => {
    expect(entranceOffset('bottom', 0, 0, 100)[1]).toBe(100);
    expect(entranceOffset('bottom', 0.5, 0, 100)).toEqual([0, 0]);
    expect(entranceOffset('left', 0.1, 0, 100)[0]).toBeLessThan(0);
    expect(entranceOffset('none', 0, 1, 100)).toEqual([0, 0]);
  });
});

describe('sprites', () => {
  it('fills polygons at pixel centres without anti-aliasing', () => {
    const sprite = createSprite(10, 10);
    fillPolygon(
      sprite,
      [
        [2, 2],
        [8, 2],
        [8, 8],
        [2, 8],
      ],
      5,
    );
    expect(sprite.data.filter((value) => value === 5).length).toBe(36);
    expect(new Set(sprite.data)).toEqual(new Set([0, 5]));
  });
});
