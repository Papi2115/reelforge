/**
 * The breakthrough page methods (PLAN.md#13.6 part c) without a browser: `page.popup(...)` (opens,
 * the red pen pulls the tab, the hand is scripted, readable errors) and `page.strip(...)` (the
 * strip moves under a dragging hand, red only on the highlight, pace fitted to `until`, readable
 * errors), both pure functions of t in any seek order; plus the hand track's busy stretches.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { hexPixel } from '../../../looks/blueprint/raster.js';
import { SKETCHBOOK_PALETTE } from '../../../testing/palettes.js';
import { testRng } from '../../../testing/rng.js';
import { createHandTrack, type HandRules } from '../draw/hand.js';
import { strokeMark } from '../draw/marks.js';
import { identity } from '../draw/paths.js';
import type { PageApi } from '../page/api.js';
import { SKETCHBOOK_STYLE } from '../style.js';

type Page = THREE.Group & PageApi & { update(t: number): void };
const SIZE = [480, 270] as const;

function page(params: Record<string, unknown> = {}): Page {
  const { api } = createKit({
    three: THREE,
    palette: SKETCHBOOK_PALETTE,
    rng: testRng(4),
    style: 'sketchbook',
  });
  const factory = (api.fx as unknown as Record<string, (p: unknown) => Page>)['sketchPage'];
  if (!factory) throw new Error('sketchPage is not bound');
  return factory({ size: SIZE, seed: 11, pen: false, ...params });
}

function pixelsAt(target: Page, t: number): Uint32Array {
  target.update(t);
  const mesh = target.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const texture = mesh.material.uniforms['map']?.value as THREE.DataTexture;
  return new Uint32Array(Uint8Array.from(texture.image.data as Uint8Array).buffer);
}

const same = (a: Uint32Array, b: Uint32Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

function count(pixels: Uint32Array, swatch: string): number {
  const colour = hexPixel(
    (SKETCHBOOK_STYLE.palette as Record<string, string>)[swatch] ?? '#000000',
  );
  return pixels.reduce((total, pixel) => total + (pixel === colour ? 1 : 0), 0);
}

function expectPure(make: () => Page, times: readonly number[]): void {
  const [a, b] = [make(), make()];
  const forward = times.map((t) => pixelsAt(a, t));
  const backward = [...times]
    .reverse()
    .map((t) => pixelsAt(b, t))
    .reverse();
  forward.forEach((frame, index) => {
    expect(same(frame, backward[index] ?? new Uint32Array()), `t=${String(times[index])}`).toBe(
      true,
    );
  });
}

const POPUP = {
  at: 0.36,
  elements: [
    { kind: 'arm', u: 220, length: 160, angle: 22.7, swing: -19 },
    { kind: 'block', u: 236, band: 'MARCH', text: '21' },
    { kind: 'tag', lines: ['spring', 'equinox'] },
    { kind: 'note', text: 'same date, same season' },
  ],
  pull: { at: 4.4 },
};

function popupPage(params: Record<string, unknown> = {}): { target: Page; handle: unknown } {
  const target = page(params);
  return { target, handle: target.popup(POPUP) };
}

describe('page.popup', () => {
  it('opens from a shut kraft card, then the red pen pulls the tab and marks the gap', () => {
    const { target, handle } = popupPage();
    expect(handle).toMatchObject({ at: 0.36, open: 0.36 + 1.48 });
    const { end, notch } = handle as { end: number; notch: readonly number[] };
    expect(end).toBeCloseTo(4.4 + 1.72 + 0.2 + 0.06 + 0.09, 1);
    expect(notch).toHaveLength(2);
    const shut = pixelsAt(target, 0.2);
    const open = pixelsAt(target, 3.5);
    expect(count(shut, 'kraft')).toBeGreaterThan(count(open, 'kraft') + 2000);
    expect(count(open, 'orange')).toBeGreaterThan(200);
    expect(count(open, 'red')).toBe(0);
    const pulled = pixelsAt(target, 7.2);
    expect(same(open, pulled)).toBe(false);
    expect(count(pulled, 'red')).toBeGreaterThan(80);
  });

  it('is a pure function of t in any seek order', () => {
    expectPure(() => popupPage().target, [0.2, 0.8, 1.2, 1.6, 3, 4.9, 5.9, 7.2]);
  });

  it('scripts the hand while it lifts the cover and pulls the tab', () => {
    const withHand = popupPage({ pen: true }).target;
    const without = popupPage().target;
    for (const t of [1, 4.8]) {
      expect(same(pixelsAt(withHand, t), pixelsAt(without, t)), `t=${String(t)}`).toBe(false);
    }
    expect(same(pixelsAt(withHand, 3.2), pixelsAt(without, 3.2))).toBe(true);
  });

  it('explains what is wrong with a spec', () => {
    const bad =
      (spec: Record<string, unknown>): (() => unknown) =>
      () =>
        page().popup(spec);
    const elements = POPUP.elements;
    expect(bad({ elements: Array.from({ length: 7 }, () => elements[1]) })).toThrow(
      /elements: Too big/i,
    );
    expect(bad({ elements: [{ kind: 'block', u: 0, w: 60, text: '2024' }] })).toThrow(
      /too wide for the block/,
    );
    expect(bad({ elements: [{ kind: 'block', u: 380, text: '21' }] })).toThrow(
      /past the card width/,
    );
    expect(bad({ elements: [{ kind: 'arm', u: 100, swing: 0 }] })).toThrow(/swing needs pull/);
    expect(bad({ elements: [{ kind: 'arm', u: 100 }], pull: { at: 4 } })).toThrow(
      /give one arm a swing angle/,
    );
    expect(bad({ ...POPUP, pull: { at: 1 } })).toThrow(/after the card has settled/);
    expect(bad({ elements: [{ kind: 'note', text: 'tab\there' }] })).toThrow(/cannot letter/);
    expect(bad({ elements: [{ kind: 'wheel', u: 3 }] })).toThrow(/kind/);
  });
});

const EVENTS = [
  { label: '45 BC', year: -45, note: ['Caesar: +1 day', 'every 4 years'] },
  { label: '325', year: 325, note: 'equinox: 21 March', doodle: 'sun' },
  { label: '1500s', year: 1500, note: ['equinox slipped', '~10 days'] },
  { label: '1582', year: 1582, note: '−10 days' },
  { label: '1752', year: 1752, note: 'Britain: −11 days' },
];

type StripResult = { at: number; end: number; events: { at: number; end: number }[] };

function stripPage(spec: Record<string, unknown> = {}): { target: Page; handle: StripResult } {
  const target = page();
  const handle = target.strip({ events: EVENTS, highlight: 3, end: 'now', ...spec });
  return { target, handle: handle as StripResult };
}

describe('page.strip', () => {
  it('writes the events in order, the highlight after a held beat, and fits `until`', () => {
    const { handle } = stripPage({ at: 0.18, until: 7.5 });
    expect(handle.at).toBeCloseTo(0.18, 5);
    expect(handle.end).toBeCloseTo(7.5, 5);
    handle.events.forEach((event, index) => {
      expect(event.end).toBeGreaterThan(event.at);
      const before = handle.events[index - 1];
      if (before) expect(event.at).toBeGreaterThan(before.end);
    });
    const [, , third, hero] = handle.events;
    expect((hero?.at ?? 0) - (third?.end ?? 0)).toBeGreaterThanOrEqual(0.4);
  });

  it('drags the strip under the left hand and keeps red on the highlight only', () => {
    const { target, handle } = stripPage();
    const hero = handle.events[3];
    if (!hero) throw new Error('no highlight');
    const early = pixelsAt(target, 1);
    expect(count(early, 'red')).toBe(0);
    expect(count(early, 'coffeeLight')).toBe(0);
    const third = handle.events[2];
    const dragging = pixelsAt(target, (third?.at ?? 0) - 0.45);
    expect(count(dragging, 'coffeeLight')).toBeGreaterThan(500);
    expect(count(pixelsAt(target, hero.at), 'red')).toBe(0);
    expect(count(pixelsAt(target, handle.end + 1), 'red')).toBeGreaterThan(50);
  });

  it('is a pure function of t in any seek order', () => {
    expectPure(() => stripPage().target, [0.4, 1.6, 2.9, 3.4, 5.2, 6.4, 7.9, 9]);
  });

  it('explains what is wrong with a spec', () => {
    const bad =
      (spec: Record<string, unknown>): (() => unknown) =>
      () =>
        page().strip(spec);
    expect(bad({ events: Array.from({ length: 9 }, () => ({ label: 'x' })) })).toThrow(
      /events: Too big/i,
    );
    expect(bad({ events: EVENTS, highlight: 5 })).toThrow(/highlight 5 is not an event index/);
    expect(bad({ events: [{ label: 'a', year: 1 }, { label: 'b' }] })).toThrow(
      /every event a year, or none/,
    );
    expect(
      bad({
        events: [
          { label: 'a', year: 5 },
          { label: 'b', year: 1 },
        ],
      }),
    ).toThrow(/years must increase/);
    expect(bad({ events: EVENTS, until: 2 })).toThrow(/events take ~[\d.]+ s/);
    expect(bad({ events: [{ label: 'a' }, { label: 'b', note: 'x'.repeat(23) }] })).toThrow(
      /Too big/i,
    );
  });
});

describe('the hand track around busy stretches', () => {
  const rules = (busy: HandRules['busy']): HandRules => ({
    keepClear: [],
    rest: null,
    restGap: 1.5,
    scale: 1,
    width: 960,
    ...(busy ? { busy } : {}),
  });
  const marks = [
    strokeMark([100, 100, 200, 100], { t0: 1, dur: 0.2, seed: 1 }),
    strokeMark([300, 100, 400, 100], { t0: 2.6, dur: 0.2, seed: 2 }),
  ];

  it('hovers across a short pause, but leaves when another hand works the page', () => {
    expect(createHandTrack(marks, rules(undefined), identity).state(2, null)).not.toBeNull();
    const busy = createHandTrack(marks, rules([[1.4, 2.1]]), identity);
    expect(busy.state(2, null)).toBeNull();
    expect(busy.state(1.25, null)).not.toBeNull();
  });
});
