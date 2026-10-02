import { describe, expect, it } from 'vitest';
import { NO_ANCHORS } from '../anchors.js';
import type { SceneContext } from '../contract.js';
import { EngineError } from '../errors.js';
import { buildShot, type BuiltShot } from '../shot.js';
import { resolveStyle } from '../style.js';
import { hexToRgb8 } from './surface.js';
import type { TextCard } from './types.js';

const style = resolveStyle({});
const WIDTH = 640;
const HEIGHT = 360;

function shotWith(
  update: (t: number, ctx: SceneContext) => void,
  build: (ctx: SceneContext) => unknown = () => null,
): BuiltShot {
  return buildShot({
    shot: { id: 'txt', t0: 0, duration: 6, width: WIDTH, height: HEIGHT, fps: 30 },
    module: {
      meta: { id: 'txt' },
      build,
      update: (t, _state, ctx) => {
        update(t, ctx);
      },
    },
    projectSeed: 3,
    palette: style.palette,
    resolveAnchor: NO_ANCHORS,
  });
}

function inkPixels(shot: BuiltShot): number {
  let count = 0;
  for (let offset = 3; offset < shot.overlay.pixels.length; offset += 4) {
    if (shot.overlay.pixels[offset] === 255) count += 1;
  }
  return count;
}

/** Every opaque overlay pixel lies inside `box` and has one of `colors`. */
function expectInside(shot: BuiltShot, box: TextCard['box'], colors: readonly string[]): void {
  const allowed = new Set(colors.map((hex) => hexToRgb8(hex).join(',')));
  const { pixels } = shot.overlay;
  for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
    if (pixels[index * 4 + 3] !== 255) continue;
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    expect(x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h).toBe(true);
    expect(allowed.has([...pixels.subarray(index * 4, index * 4 + 3)].join(','))).toBe(true);
  }
}

describe('ctx.text cards', () => {
  it('draws a centred title in palette colours inside its box, only between at and until', () => {
    const shot = shotWith((_t, ctx) => {
      ctx.text.title('Zażółć gęślą jaźń', { at: 1, until: 4, enter: 'none' });
    });
    shot.update(0.5);
    expect(shot.overlay.empty).toBe(true);
    expect(shot.cards()).toMatchObject([{ id: 'title:Zażółć gęślą jaźń', visible: false }]);
    shot.update(2);
    const [card] = shot.cards();
    expect(card).toMatchObject({ kind: 'title', at: 1, until: 4, visible: true });
    const box = card?.box ?? { x: 0, y: 0, w: 0, h: 0 };
    expect(Math.abs(box.x + box.w / 2 - WIDTH / 2)).toBeLessThanOrEqual(2);
    expect(inkPixels(shot)).toBeGreaterThan(500);
    expectInside(shot, box, [style.palette.text, style.palette.outline]);
    shot.update(4);
    expect(shot.overlay.empty).toBe(true);
  });

  it('renders the same pixels for the same t, in any order (shake is seeded)', () => {
    const shot = shotWith((_t, ctx) => {
      ctx.text.title('SHAKE', { enter: 'shake', enterDuration: 2 });
    });
    const snapshot = (t: number): number[] => {
      shot.update(t);
      return [...shot.overlay.pixels];
    };
    const first = snapshot(0.5);
    const other = snapshot(0.55);
    expect(snapshot(0.5)).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('animates enter and exit: pop grows, typewriter reveals, fade dissolves', () => {
    const pop = shotWith((_t, ctx) => ctx.text.title('POP', { enter: 'pop', enterDuration: 1 }));
    const popInk = [0.2, 0.5, 2].map((t) => {
      pop.update(t);
      return inkPixels(pop);
    });
    expect(popInk[0]).toBeLessThan(popInk[2] ?? 0);

    const typed = shotWith((_t, ctx) =>
      ctx.text.title('TYPEWRITER', { enter: 'typewriter', enterDuration: 1, shadow: false }),
    );
    const typedInk = [0.05, 0.5, 1.5].map((t) => {
      typed.update(t);
      return inkPixels(typed);
    });
    expect(typedInk).toEqual([...typedInk].sort((a, b) => a - b));
    expect(new Set(typedInk).size).toBe(3);

    const fade = shotWith((_t, ctx) =>
      ctx.text.title('FADE', { enter: 'none', exit: 'fade', until: 5, exitDuration: 1 }),
    );
    fade.update(2);
    const solid = inkPixels(fade);
    fade.update(4.5);
    expect(inkPixels(fade)).toBeGreaterThan(solid * 0.3);
    expect(inkPixels(fade)).toBeLessThan(solid * 0.7);
  });

  it('places the lower third on a plate at the bottom-left of the safe area', () => {
    const shot = shotWith((_t, ctx) => {
      ctx.text.lowerThird('Papi Kowalski', 'twórca · ReelForge', { enter: 'none' });
    });
    shot.update(1);
    const [card] = shot.cards();
    const safe = shot.safeArea;
    expect(safe).toEqual({ x: 32, y: 18, w: 576, h: 324 });
    expect(card?.box.x).toBe(safe.x);
    expect((card?.box.y ?? 0) + (card?.box.h ?? 0)).toBe(safe.y + safe.h);
    expect(card?.text).toBe('Papi Kowalski / twórca · ReelForge');
    const { palette } = style;
    expectInside(shot, card?.box ?? safe, [
      palette.text,
      palette.textDim,
      palette.shadow,
      palette.accent1,
    ]);
  });

  it('reveals kinetic words one by one, timed by perWordDelay or per-word t', () => {
    const shot = shotWith((_t, ctx) => {
      ctx.text.kinetic(['ONE', { text: 'TWO', t: 2 }, 'THREE'], { at: 1, perWordDelay: 0.5 });
    });
    const ink = [0.9, 1.3, 1.8, 2.3].map((t) => {
      shot.update(t);
      return inkPixels(shot);
    });
    expect(ink[0]).toBe(0);
    expect(ink[1]).toBeGreaterThan(0);
    // THREE (index 2 -> 1 + 2 * 0.5 = 2.0) and TWO (t = 2) appear together.
    expect(ink[2]).toBe(ink[1]);
    expect(ink[3]).toBeGreaterThan(ink[2] ?? 0);
    expect(shot.cards()[0]).toMatchObject({ kind: 'kinetic', at: 1, text: 'ONE TWO THREE' });
  });

  it('measures text in low-res pixels with word wrap', () => {
    let metrics: unknown;
    shotWith(
      () => undefined,
      (ctx) => {
        metrics = ctx.text.measure('hello world', { font: 'mono', maxWidth: 0.05 });
        return null;
      },
    );
    expect(metrics).toEqual({ w: 29, h: 24, lines: ['hello', 'world'] });
  });

  it('gives unique ids to repeated cards and reports bad calls clearly', () => {
    const shot = shotWith((_t, ctx) => {
      ctx.text.title('A');
      ctx.text.title('A');
    });
    shot.update(1);
    expect(shot.cards().map((card) => card.id)).toEqual(['title:A', 'title:A#2']);

    const badColor = shotWith((_t, ctx) => ctx.text.title('X', { color: 'gold' }));
    expect(() => {
      badColor.update(0);
    }).toThrow(
      /ctx\.text\.title\(\) \[card "title:X"\]: options\.color: "gold" is not a colour of this style; use a palette token \(sky, .*text/,
    );
    const badOption = shotWith((_t, ctx) => ctx.text.title('X', { colour: 'text' } as never));
    expect(() => {
      badOption.update(0);
    }).toThrow(/ctx\.text\.title\(\): options: Unrecognized key: "colour"/);
    expect(() =>
      shotWith(
        () => undefined,
        (ctx) => ctx.text.title('in build'),
      ),
    ).toThrow(expect.objectContaining({ code: 'text-outside-update' }) as EngineError);
  });
});
