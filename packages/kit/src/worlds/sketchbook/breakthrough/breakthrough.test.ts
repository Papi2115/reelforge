/**
 * The breakthrough page methods (PLAN.md#13.6 part c) without a browser: `page.popup(...)` (opens,
 * the red pen pulls the tab, the pull moves what the scene bound to it (motions or a pure drive,
 * pieces rising on their words), the hand is scripted, readable errors) and `page.strip(...)` (the
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
  intent: 'the date stays while the sun slides off its notch: the season drifts',
  at: 0.36,
  elements: [
    { kind: 'arm', id: 'sun', u: 220, length: 160, angle: 22.7 },
    { kind: 'block', u: 236, band: 'MARCH', text: '21' },
    { kind: 'tag', lines: ['spring', 'equinox'] },
    { kind: 'note', text: 'same date, same season' },
  ],
  pull: {
    at: 4.4,
    motions: [{ target: 'sun', to: { angle: -19 }, ease: 'lin' }],
    callout: 'notch',
  },
};

function popupPage(params: Record<string, unknown> = {}): { target: Page; handle: unknown } {
  const target = page(params);
  return { target, handle: target.popup(POPUP) };
}

/** A gauge card whose pull is bound to `motions` (the same card, different mechanisms). */
function gaugePage(motions: readonly Record<string, unknown>[]): Page {
  const target = page();
  target.popup({
    intent: 'the spare hours fill up until they make a whole day',
    elements: [
      { kind: 'gauge', id: 'spare', u: 90, v: 30, level: 0.5, label: 'SPARE' },
      { kind: 'counter', id: 'hours', u: 250, v: 120, from: 12, suffix: ' h' },
      { kind: 'flap', id: 'door', u: 300, v: 40, w: 90, h: 60, text: 'WHY?' },
    ],
    pull: { at: 2.4, motions },
  });
  return target;
}

describe('page.popup', () => {
  it('opens from a shut kraft card, then the red pen pulls the tab and marks the gap', () => {
    const { target, handle } = popupPage();
    expect(handle).toMatchObject({ at: 0.36, open: 0.36 + 1.48, intent: POPUP.intent });
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

  it('moves what the pull is bound to: other motions, other pictures, each pure in t', () => {
    const fill = [{ target: 'spare', to: { level: 1 } }];
    const drain = [{ target: 'spare', to: { level: 0 } }];
    const door = [
      { target: 'door', to: { open: 0.9 }, ease: 'back' },
      { target: 'hours', to: { value: 24 }, span: [0.3, 1], ease: 'lin' },
    ];
    const before = [fill, drain, door].map((motions) => pixelsAt(gaugePage(motions), 2));
    const after = [fill, drain, door].map((motions) => pixelsAt(gaugePage(motions), 4.4));
    expect(same(before[0] ?? new Uint32Array(), before[1] ?? new Uint32Array())).toBe(true);
    expect(same(before[0] ?? new Uint32Array(), before[2] ?? new Uint32Array())).toBe(true);
    for (const [a, b] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      expect(
        same(after[a] ?? new Uint32Array(), after[b] ?? new Uint32Array()),
        `${String(a)}/${String(b)}`,
      ).toBe(false);
    }
    // The tube fills in blue ballpoint by default: red stays the page's one correction.
    expect(count(after[0] ?? new Uint32Array(), 'bic')).toBeGreaterThan(
      count(after[1] ?? new Uint32Array(), 'bic') + 200,
    );
    for (const motions of [fill, drain, door]) {
      expectPure(() => gaugePage(motions), [1, 2.5, 3.1, 3.6, 4.4]);
    }
  });

  it('lets a pure drive(p, t) move pieces, and raises pieces on their own words', () => {
    const target = page();
    const handle = target.popup({
      intent: 'the counter runs as the pull goes, and the block rises on its word',
      elements: [
        { kind: 'counter', id: 'n', u: 200, v: 100, from: 0 },
        { kind: 'block', u: 40, text: '29', at: 2.6 },
      ],
      pull: {
        at: 3,
        drive: (p: number) => ({ n: { value: Math.round(100 * p) } }),
        callout: 'none',
      },
    });
    expect(handle).toMatchObject({ pulled: 3 + 0.12 + 0.98 });
    const [early, risen, counted] = [2.2, 3.05, 4.6].map((t) => pixelsAt(target, t));
    expect(same(early ?? new Uint32Array(), risen ?? new Uint32Array())).toBe(false);
    expect(same(risen ?? new Uint32Array(), counted ?? new Uint32Array())).toBe(false);
  });

  it('explains what is wrong with a spec', () => {
    const bad =
      (spec: Record<string, unknown>): (() => unknown) =>
      () =>
        page().popup({ intent: POPUP.intent, ...spec });
    const elements = POPUP.elements;
    expect(() => page().popup({ elements })).toThrow(/intent/);
    expect(bad({ elements: Array.from({ length: 9 }, () => elements[1]) })).toThrow(
      /elements: Too big/i,
    );
    expect(bad({ elements: [{ kind: 'block', u: 0, w: 60, text: '2024' }] })).toThrow(
      /too wide for the block/,
    );
    expect(bad({ elements: [{ kind: 'block', u: 380, text: '21' }] })).toThrow(
      /past the card width/,
    );
    expect(bad({ elements, pull: { at: 4 } })).toThrow(/pull moves nothing/);
    expect(
      bad({ elements, pull: { at: 4, motions: [{ target: 'disc', to: { angle: 3 } }] } }),
    ).toThrow(/"disc" is not a piece of this card/);
    expect(
      bad({ elements, pull: { at: 4, motions: [{ target: 'sun', to: { level: 1 } }] } }),
    ).toThrow(/the arm cannot move "level"/);
    expect(bad({ elements: [{ kind: 'arm', u: 100, piece: 'disc' }], pull: undefined })).toThrow(
      /disc must say what it stands for/,
    );
    expect(bad({ elements: [{ kind: 'card', u: 100, v: 40 }] })).toThrow(/needs text or a drawing/);
    expect(bad({ elements, pull: { at: 4, drive: () => ({ ghost: { angle: 1 } }) } })).toThrow(
      /drive moves "ghost"/,
    );
    expect(bad({ ...POPUP, pull: { ...POPUP.pull, at: 1 } })).toThrow(/after the card has settled/);
    expect(bad({ elements: [{ kind: 'note', text: 'tab\there' }] })).toThrow(/cannot letter/);
    expect(bad({ elements: [{ kind: 'robot', u: 3 }] })).toThrow(/kind/);
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
