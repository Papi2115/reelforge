/**
 * The level card's title band (real run Game B2 2: the level-card transition left an empty band):
 * `hud.levelCard` types the new place into a ribbed black band across the middle of the frame,
 * holds it and sweeps it off right; readable errors for text it cannot draw or a card too short.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../../../kit.js';
import { testRng } from '../../../testing/rng.js';
import { GAME_B2_ID } from '../index.js';
import { B2_TABLE, C, T } from '../palette.js';
import { SCREEN_W } from '../view/output.js';
import { CARD_BAND, levelCardSchema, planLevelCard } from './level-card.js';
import { HudModel } from './model.js';

const PALETTE: Readonly<Record<string, string>> = Object.fromEntries(
  B2_TABLE.map(([, swatch, hex]) => [swatch, hex]),
);

const fail = (message: string): never => {
  throw new Error(message);
};

function hudWithCard(): HudModel {
  const model = new HudModel(4, 5);
  const o = levelCardSchema.parse({ place: 'The river ford', sub: '1871' });
  model.levelCard(planLevelCard(o, 0, undefined, 4, fail));
  return model;
}

/** Row y of the screen as palette indices. */
const row = (model: HudModel, t: number, y: number): number[] =>
  Array.from(model.draw(t, undefined, undefined).d.subarray(y * SCREEN_W, (y + 1) * SCREEN_W));

describe('hud.levelCard', () => {
  it('fills the band from the first frame and types the place into it', () => {
    const model = hudWithCard();
    const middle = CARD_BAND.top + 1;
    expect(row(model, 0, middle).every((c) => c === C.VOID)).toBe(true);
    expect(row(model, 0, CARD_BAND.top - 1).every((c) => c === T)).toBe(true);
    const typed = (t: number): number =>
      [...model.draw(t, undefined, undefined).d].filter((c) => c === C.TUNGSTEN).length;
    expect(typed(0)).toBe(0);
    expect(typed(1.2)).toBeGreaterThan(typed(0.25));
    expect(typed(1.2)).toBeGreaterThan(100);
  });

  it('sweeps off right at the end and is gone at until (default at + 1.8)', () => {
    const model = hudWithCard();
    const middle = CARD_BAND.top + 1;
    const sweeping = row(model, 1.6, middle);
    expect(sweeping[0]).toBe(T);
    expect(sweeping[SCREEN_W - 1]).toBe(C.VOID);
    expect(row(model, 1.8, middle).every((c) => c === T)).toBe(true);
  });

  it('is bound on b2Hud with readable errors', () => {
    const fx: Readonly<Record<string, unknown>> = createKit({
      three: THREE,
      palette: PALETTE,
      rng: testRng(2),
      style: GAME_B2_ID,
    }).api.fx;
    const factory = fx['b2Hud'] as (p: Record<string, unknown>) => Record<string, unknown>;
    const hud = factory({ duration: 4 });
    const levelCard = hud['levelCard'] as (o: unknown) => { at: number; end: number };
    expect(levelCard({ place: 'the harbour', at: 0 })).toEqual({ at: 0, end: 1.8 });
    expect(() => levelCard({ place: 'café', at: 0 })).toThrow(/cannot draw: É/);
    expect(() => levelCard({ place: 'the harbour', at: 0, until: 0.8 })).toThrow(/>= 1.2 s/);
  });
});
