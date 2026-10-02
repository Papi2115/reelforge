import { describe, expect, it } from 'vitest';
import { testRng } from '../testing/rng.js';
import { bars3dParams, barHeights, categoryLayout } from './bars.js';
import {
  counterParams,
  counterValue,
  drumOffset,
  formatCounter,
  odometerWheels,
} from './counter.js';
import { dissolvePhase, frontOrder } from './dissolve.js';
import { flickerLevel, flickerParams, flickerRaw, FLICKER_PATTERNS } from './flicker.js';
import { glitchLevel } from './glitch.js';
import { landMask, landShare } from './map-regions.js';
import { landHeights, reachTime, routeShareAt, stackLabels } from './map.js';
import { edgeProgress, nodeGraphParams, nodePositions } from './node-graph.js';
import { glitchPixels, textPixels } from './screen.js';
import {
  coneDirection,
  flashSize,
  impactTime,
  scatterShards,
  shardExplosionParams,
  shardState,
  type Shard,
} from './shards.js';
import { progress } from './shared.js';
import { tickerOffset, tickerParams, typewriterParams, typewriterTimes } from './text-fx.js';
import { axisProgress, milestoneTimes, timeline3dParams } from './timeline.js';
import { samplePolyline } from './trail.js';

const SHARD: Shard = {
  velocity: [1, 4, 0],
  life: 2,
  size: 0.2,
  spin: [1, 0, 0],
  tilt: [0, 0, 0],
  color: 'hero',
  glow: false,
};

describe('shardExplosion math', () => {
  it('flies ballistically, lands on the floor and shrinks away at the end of its life', () => {
    expect(shardState(SHARD, -0.1, 10, 0).scale).toBe(0);
    const flying = shardState(SHARD, 0.5, 10, 0);
    expect(flying.position[0]).toBeCloseTo(0.5);
    expect(flying.position[1]).toBeCloseTo(4 * 0.5 - 0.5 * 10 * 0.25);
    expect(flying.scale).toBeCloseTo(0.2);
    // vy = 4, g = 10: back at the origin height after 0.8 s.
    expect(impactTime(4, 10, 0)).toBeCloseTo(0.8);
    const landed = shardState(SHARD, 1.2, 10, 0);
    expect(landed.position).toEqual([expect.closeTo(0.8), 0.1, 0]);
    expect(landed.rotation[0]).toBeCloseTo(0.8);
    expect(shardState(SHARD, 1.9, 10, 0).scale).toBeLessThan(0.2);
    expect(shardState(SHARD, 2, 10, 0).scale).toBe(0);
    expect(impactTime(4, 10, null)).toBe(Infinity);
    expect(shardState(SHARD, 1.2, 10, null).position[1]).toBeCloseTo(4 * 1.2 - 5 * 1.44);
  });

  it('scatters a seeded burst inside the cone', () => {
    const params = shardExplosionParams.parse({ count: 50, spread: 0.25, seed: 1 });
    const shards = scatterShards(testRng(4), params);
    expect(shards).toHaveLength(50);
    expect(scatterShards(testRng(4), params)).toEqual(shards);
    for (const shard of shards) {
      const speed = Math.hypot(...shard.velocity);
      expect(speed).toBeGreaterThanOrEqual(2.5);
      expect(speed).toBeLessThanOrEqual(6);
      // spread 0.25 = 45 degrees around +y.
      expect(shard.velocity[1] / speed).toBeGreaterThanOrEqual(Math.cos(Math.PI / 4) - 1e-9);
    }
    const direction = coneDirection(testRng(9), [1, 0, 0], 0);
    expect(direction[0]).toBeCloseTo(1);
    expect(flashSize(0.1, 1)).toBeCloseTo(1);
    expect(flashSize(0.3, 1)).toBe(0);
  });
});

describe('counter math', () => {
  it('eases the value from `from` to `to` between start and end', () => {
    const params = counterParams.parse({ from: 0, to: 1000, start: 1, end: 3, ease: 'linear' });
    expect(counterValue(params, 0)).toBe(0);
    expect(counterValue(params, 2)).toBe(500);
    expect(counterValue(params, 9)).toBe(1000);
  });

  it('rolls odometer wheels with carries', () => {
    expect(odometerWheels(1024, 4)).toEqual([4, 2, 0, 1]);
    const rolling = odometerWheels(1999.5, 4);
    expect(rolling.map((value) => Number(value.toFixed(3)))).toEqual([9.5, 9.5, 9.5, 1.5]);
    expect(odometerWheels(1234.25, 4)[1]).toBe(3);
    expect(drumOffset(3, 2.5)).toBeCloseTo(0.5);
    expect(drumOffset(0, 9.5)).toBeCloseTo(0.5);
  });

  it('formats separators, decimals and units', () => {
    const format = counterParams.parse({}).format;
    expect(formatCounter(1024, { ...format, suffix: 'KB' })).toBe('1,024 KB');
    expect(formatCounter(12500.75, { ...format, prefix: '$', decimals: 2 })).toBe('$12,500.75');
    expect(formatCounter(-1234567, { ...format, separator: ' ' })).toBe('-1 234 567');
    expect(formatCounter(-0.001, format)).toBe('0');
  });
});

describe('bars3d math', () => {
  const params = bars3dParams.parse({
    data: [
      { label: 'A', value: 10 },
      { label: 'B', value: 20 },
    ],
    height: 4,
    start: 1,
    stagger: 0.5,
    grow: 1,
    ease: 'linear',
  });

  it('grows each bar to value / max x height after its delay', () => {
    expect(barHeights(params, 0)).toEqual([0, 0]);
    expect(barHeights(params, 1.5)).toEqual([1, 0]);
    expect(barHeights(params, 2)).toEqual([2, 2]);
    expect(barHeights(params, 5)).toEqual([2, 4]);
    expect(barHeights({ ...params, max: 40 }, 5)).toEqual([1, 2]);
  });

  it('staggers category labels that do not fit their bar', () => {
    expect(categoryLayout(params).staggered).toBe(false);
    const long = bars3dParams.parse({
      data: ['Calculator', 'Pregnancy test', 'Fridge'].map((label) => ({ label, value: 1 })),
    });
    const layout = categoryLayout(long);
    expect(layout.staggered).toBe(true);
    expect(layout.height).toBeGreaterThan(categoryLayout({ ...long, gap: 0 }).height * 0.99);
  });
});

describe('nodeGraph and timeline math', () => {
  it('lays nodes out on a circle and draws edges after both nodes', () => {
    const params = nodeGraphParams.parse({
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c', position: [5, 5] }, { id: 'd' }],
      edges: [{ from: 'a', to: 'b' }],
      radius: 2,
      stagger: 1,
      drawTime: 1,
    });
    const positions = nodePositions(params);
    expect(positions[0]?.[1]).toBeCloseTo(2);
    expect(positions[1]?.[0]).toBeCloseTo(2);
    expect(positions[2]).toEqual([5, 5]);
    // Node b pops at 1 s; the edge starts half a pop later and draws for 1 s.
    expect(edgeProgress(params, 0, 1.1)).toBe(0);
    expect(edgeProgress(params, 0, 1.675)).toBeCloseTo(0.5);
    expect(edgeProgress(params, 0, 9)).toBe(1);
  });

  it('reveals milestones when the axis reaches them', () => {
    const params = timeline3dParams.parse({
      items: [{ label: 'a' }, { label: 'b' }],
      start: 1,
      drawTime: 2,
      ease: 'easeInOutCubic',
    });
    const times = milestoneTimes(params);
    expect(axisProgress(params, times[0] ?? 0)).toBeCloseTo(0.25, 4);
    expect(axisProgress(params, times[1] ?? 0)).toBeCloseTo(0.75, 4);
    expect(milestoneTimes({ ...params, items: [{ label: 'x', caption: '', at: 7 }] })).toEqual([7]);
  });
});

describe('map math', () => {
  it('builds land masks with sensible land shares', () => {
    const europe = landMask('europe', 72, 0);
    expect(landShare(europe)).toBeGreaterThan(0.3);
    expect(landShare(europe)).toBeLessThan(0.7);
    const project = europe.project;
    if (!project) throw new Error('europe must be geographic');
    const [u, v] = project(2.35, 48.86); // Paris: land
    expect(europe.land[Math.floor(v * europe.rows) * europe.columns + Math.floor(u * 72)]).toBe(1);
    const [bu, bv] = project(-15, 45); // Atlantic: water
    expect(europe.land[Math.floor(bv * europe.rows) * 72 + Math.max(0, Math.floor(bu * 72))]).toBe(
      0,
    );
    expect(landShare(landMask('generic', 72, 5))).toBeCloseTo(0.38, 1);
    expect(landShare(landMask('islands', 72, 5))).toBeCloseTo(0.2, 1);
    expect(landMask('generic', 72, 5)).toEqual(landMask('generic', 72, 5));
    const heights = landHeights(europe, 1);
    expect(Math.max(...heights)).toBeLessThanOrEqual(3);
  });

  it('times pins by where the route passes and stacks clashing labels', () => {
    const route = [
      [0, 0],
      [1, 0],
      [1, 1],
    ] as const;
    expect(routeShareAt(route, [0.5, 0.1])).toBeCloseTo(0.25);
    expect(routeShareAt(route, [1.2, 1])).toBeCloseTo(1);
    expect(reachTime((t) => progress(t, 1, 3), 1, 3, 0.5)).toBeCloseTo(2, 4);
    const levels = stackLabels(
      [
        { x: 0, z: 0, width: 1 },
        { x: 0.5, z: 0, width: 1 },
        { x: 3, z: 0, width: 1 },
        { x: 0.2, z: 0.1, width: 1 },
      ],
      0.3,
    );
    expect(levels).toEqual([0, 1, 0, 2]);
  });
});

describe('dissolve, glitch, flicker, screen math', () => {
  it('sweeps the dissolve front', () => {
    expect(dissolvePhase(0, 0)).toBe(0);
    expect(dissolvePhase(0, 0.3)).toBe(1);
    expect(dissolvePhase(1, 0.7)).toBe(0);
    expect(dissolvePhase(1, 1)).toBe(1);
    expect(frontOrder('up', [0.2, 0.9, 0], 0.5)).toBe(0.9);
    expect(frontOrder('down', [0.2, 0.9, 0], 0.5)).toBeCloseTo(0.1);
    expect(frontOrder('random', [0.2, 0.9, 0], 0.5)).toBe(0.5);
  });

  it('glitches only inside its window', () => {
    const options = { start: 1, end: 2, intensity: 0.7, rate: 8, density: 1 };
    expect(glitchLevel(0.5, options, 3)).toBe(0);
    expect(glitchLevel(1.5, options, 3)).toBe(0.7);
    expect(glitchLevel(2, options, 3)).toBe(0);
    expect(glitchLevel(1.5, { ...options, density: 0 }, 3)).toBe(0);
  });

  it('keeps flicker levels in range and steady outside the window', () => {
    for (const pattern of FLICKER_PATTERNS) {
      for (let t = 0; t < 3; t += 0.07) {
        const value = flickerRaw(pattern, t, 6, 5);
        expect(value, pattern).toBeGreaterThanOrEqual(0);
        expect(value, pattern).toBeLessThanOrEqual(1);
      }
    }
    expect(flickerRaw('strobe', 0.01, 2, 0)).toBe(1);
    expect(flickerRaw('strobe', 0.3, 2, 0)).toBe(0);
    const params = flickerParams.parse({ start: 1, end: 2, min: 0.4, pattern: 'strobe', rate: 2 });
    expect(flickerLevel(params, 0.5, 1)).toBe(1);
    expect(flickerLevel(params, 1.3, 1)).toBeCloseTo(0.4);
  });

  it('glitches screen pixels deterministically, level 0 = the base image', () => {
    const base = textPixels(['ERR'], 24, 12);
    expect(base.data.some((value) => value === 1)).toBe(true);
    expect(glitchPixels(base, 1.3, 0, 7).data).toEqual(base.data);
    const glitched = glitchPixels(base, 1.3, 1, 7);
    expect(glitched.data).toEqual(glitchPixels(base, 1.3, 1, 7).data);
    expect(glitched.data).not.toEqual(base.data);
    expect(Math.max(...glitched.data)).toBeLessThan(4);
  });
});

describe('text effect math', () => {
  it('times typed characters per line', () => {
    const params = typewriterParams.parse({
      lines: ['AB', 'C'],
      prompt: '>',
      cps: 10,
      start: 1,
      lineDelay: 0.5,
    });
    const [first, second] = typewriterTimes(params);
    expect(first).toEqual({ start: 1, chars: [1, 1.1, 1.2], end: 1.2 });
    expect(second?.start).toBeCloseTo(1.7);
    expect(second?.chars).toHaveLength(2);
  });

  it('wraps the ticker offset', () => {
    const params = tickerParams.parse({ text: 'HI', speed: 2, start: 1 });
    expect(tickerOffset(params, 3, 0)).toBe(0);
    expect(tickerOffset(params, 3, 2)).toBe(2);
    expect(tickerOffset(params, 3, 3)).toBe(1);
    expect(tickerOffset({ ...params, speed: -2 }, 3, 2)).toBe(1);
  });

  it('samples polylines at even spacing', () => {
    const points = samplePolyline(
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
      ],
      0.5,
    );
    expect(points).toHaveLength(5);
    expect(points[2]).toEqual([1, 0, 0]);
    expect(points[4]).toEqual([1, 1, 0]);
  });
});
