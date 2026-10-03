import { describe, expect, it } from 'vitest';
import type { SceneContext } from '../contract.js';
import type { EngineError } from '../errors.js';
import { ANNOTATION_TYPE_NAMES } from './options.js';
import {
  deskCamera,
  deskShot,
  inkColors,
  inkCount,
  paletteColors,
  type DeskState,
} from './testing.js';

type Draw = (ctx: SceneContext, state: DeskState) => void;

const screen = (state: DeskState): { object: DeskState['calc']; anchor: string } => ({
  object: state.calc,
  anchor: 'screen',
});

/** One call per annotation type, all shown from t = 1 to t = 3. */
const EVERY_TYPE: Readonly<Record<string, Draw>> = {
  callout: (ctx, s) =>
    ctx.annotate.callout({
      text: 'Liquid crystal',
      title: 'LCD',
      target: screen(s),
      at: 1,
      until: 3,
    }),
  arrow: (ctx, s) => ctx.annotate.arrow({ target: s.calc, text: 'HERE', at: 1, until: 3 }),
  ring: (ctx, s) => ctx.annotate.ring({ target: screen(s), at: 1, until: 3 }),
  bracket: (ctx, s) =>
    ctx.annotate.bracket({ from: s.desk, to: s.calc, text: 'PAIR', at: 1, until: 3 }),
  pin: (ctx, s) => ctx.annotate.pin({ target: screen(s), text: 'LCD', at: 1, until: 3 }),
  underline: (ctx) => {
    ctx.text.title('BIG CLAIM', { id: 'claim', pos: [0.5, 0.2] });
    ctx.annotate.underline({ target: { card: 'claim', words: [1, 1] }, at: 1, until: 3 });
  },
  highlight: (ctx) => {
    ctx.text.title('BIG CLAIM', { id: 'claim', pos: [0.5, 0.2] });
    ctx.annotate.highlight({ target: { card: 'claim' }, at: 1, until: 3 });
  },
  badge: (ctx, s) => ctx.annotate.badge({ value: 3, target: s.calc, at: 1, until: 3 }),
  stamp: (ctx) => ctx.annotate.stamp({ text: 'LEAKED', pos: [0.7, 0.7], at: 1, until: 3 }),
  dimension: (ctx, s) =>
    ctx.annotate.dimension({ from: s.calc, to: s.calc, text: '14 CM', at: 1, until: 3 }),
  spotlight: (ctx, s) => ctx.annotate.spotlight({ target: s.calc, at: 1, until: 3 }),
};

function shotFor(draw: Draw): ReturnType<typeof deskShot> {
  return deskShot((_t, state, ctx) => {
    deskCamera(ctx);
    draw(ctx, state);
  });
}

describe('ctx.annotate', () => {
  it.each(Object.entries(EVERY_TYPE))(
    '%s: draws palette pixels only between at and until, deterministically, as a card',
    (type, draw) => {
      const shot = shotFor(draw);
      shot.update(0.5);
      const before = inkCount(shot);
      shot.update(2);
      const pixels = [...shot.overlay.pixels];
      expect(inkCount(shot)).toBeGreaterThan(before);
      for (const color of inkColors(shot)) expect(paletteColors().has(color)).toBe(true);
      const card = shot.cards().find((candidate) => candidate.kind === 'annotation');
      expect(card).toMatchObject({ visible: true, at: 1, until: 3, annotation: { type } });
      shot.update(0.7);
      shot.update(2);
      expect([...shot.overlay.pixels]).toEqual(pixels);
      shot.update(3.2);
      expect(inkCount(shot)).toBe(before);
    },
  );

  it('animates: strokes draw on, labels pop, everything starts after at', () => {
    const ring = shotFor((ctx, s) =>
      ctx.annotate.ring({ target: screen(s), pulse: false, at: 1, enterDuration: 1 }),
    );
    const drawn = [1.05, 1.4, 2.5].map((t) => {
      ring.update(t);
      return inkCount(ring);
    });
    expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
    expect(drawn[0]).toBeLessThan((drawn[2] ?? 0) / 2);
    const badge = shotFor((ctx, s) =>
      ctx.annotate.badge({ value: 1, target: s.calc, at: 1, enterDuration: 1 }),
    );
    badge.update(1.1);
    const small = inkCount(badge);
    badge.update(2.5);
    expect(small).toBeLessThan(inkCount(badge));
  });

  it('draws spotlights and highlights behind text, never over it', () => {
    const titleOnly = shotFor((ctx) => ctx.text.title('KEEP', { id: 'keep', enter: 'none' }));
    titleOnly.update(2);
    const title = [...titleOnly.overlay.pixels];
    const dimmed = shotFor((ctx, s) => {
      ctx.annotate.spotlight({ target: s.calc, enter: 'none' });
      ctx.text.title('KEEP', { id: 'keep', enter: 'none' });
      ctx.annotate.highlight({ target: { card: 'keep' }, enter: 'none' });
    });
    dimmed.update(2);
    const { pixels } = dimmed.overlay;
    for (let offset = 0; offset < title.length; offset += 4) {
      if (title[offset + 3] !== 255) continue;
      expect([...pixels.subarray(offset, offset + 4)]).toEqual(title.slice(offset, offset + 4));
    }
    expect(inkCount(dimmed)).toBeGreaterThan(20_000);
  });

  it('gives annotations ids for QA and anchors them to spoken phrases', async () => {
    const { SPOKEN } = await import('./testing.js');
    const shot = deskShot(
      (_t, s, ctx) => {
        deskCamera(ctx);
        ctx.annotate.ring({ target: s.calc });
        ctx.annotate.ring({ target: s.calc });
        ctx.annotate.pin({ target: s.calc, text: 'Calculator', phrase: 'the keypad' });
      },
      { anchors: SPOKEN },
    );
    shot.update(1.2);
    const cards = shot.cards();
    expect(cards.map((card) => card.id)).toEqual(['ring', 'ring#2', 'pin:Calculator']);
    expect(cards[2]).toMatchObject({
      at: 0.9,
      annotation: { anchor: { phrase: 'the keypad', spokenT: 0.9 } },
    });
  });

  it.each(ANNOTATION_TYPE_NAMES)(
    '%s: rejects a misspelt option and a wrong enter animation, naming the known options',
    (type) => {
      const call = (options: Record<string, unknown>): (() => void) => {
        const shot = shotFor((ctx) => {
          // Scenes are plain JS: wrong options reach the engine untyped.
          const api = ctx.annotate as unknown as Readonly<
            Record<string, (input: unknown) => unknown>
          >;
          api[type]?.(options);
        });
        return () => {
          shot.update(1);
        };
      };
      expect(call({ colour: 'text' })).toThrow(
        new RegExp(
          `ctx\\.annotate\\.${type}\\(\\): .*Unrecognized key: "colour" \\(known options: id, at, until, phrase, nth, enter`,
        ),
      );
      expect(call({ enter: 'zoom' })).toThrow(
        /options\.enter: Invalid option: expected one of "none"\|"fade"\|"pop"\|"draw"\|"wipe"/,
      );
    },
  );

  it('reports bad calls clearly (option, target, colour, missing card, build phase)', () => {
    const fails = (draw: Draw): (() => void) => {
      const shot = shotFor(draw);
      return () => {
        shot.update(1);
      };
    };
    expect(
      fails((ctx, s) => ctx.annotate.arrow({ target: s.calc, colour: 'text' } as never)),
    ).toThrow(
      /ctx\.annotate\.arrow\(\): options: Unrecognized key: "colour" \(known options: .*color.*\)/,
    );
    expect(fails((ctx) => ctx.annotate.ring({ target: { obj: 1 } } as never))).toThrow(
      /options\.target: got \{ obj \}; a target is a kit object .*\{ world: \[x, y, z\] \}/,
    );
    expect(fails((ctx, s) => ctx.annotate.ring({ target: s.calc, color: 'gold' }))).toThrow(
      /ctx\.annotate\.ring\(\) \[annotation "ring"\]: options\.color: "gold" is not a colour of this style/,
    );
    expect(fails((ctx) => ctx.annotate.underline({ target: { card: 'nope' } }))).toThrow(
      /no ctx\.text card with that id in this frame/,
    );
    expect(
      fails((ctx, s) => ctx.annotate.ring({ target: { object: s.calc, anchor: 'lid' } })),
    ).toThrow(/has no anchor "lid" \(available: center, .*screen, keypad\)/);
    expect(fails((ctx) => ctx.annotate.badge({ value: 1 }))).toThrow(/give a target .* or pos/);
    expect(
      fails((ctx, s) => ctx.annotate.pin({ target: s.calc, text: 'X', phrase: 'never said' })),
    ).toThrow(expect.objectContaining({ code: 'anchor-not-found' }) as EngineError);
    expect(() =>
      deskShot(() => undefined, {
        extra: (ctx) => {
          ctx.annotate.ring({ target: { world: [0, 0, 0] } });
        },
      }),
    ).toThrow(expect.objectContaining({ code: 'annotate-outside-update' }) as EngineError);
  });
});
