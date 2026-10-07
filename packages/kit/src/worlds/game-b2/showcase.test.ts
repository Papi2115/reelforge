/**
 * The Game B2 showcase pieces (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md "a world is a style
 * GRAMMAR"): the mockup's levels, sprites, icons and item stay valid names, marked in the catalog,
 * but the kit-docs text of b2View / b2Hud and the look docs name them only in the one showcase
 * line; a held item has no default look; an unknown level name points at the film's own level.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit, kitCatalog } from '../../kit.js';
import { LOOKS } from '../../looks/index.js';
import { testRng } from '../../testing/rng.js';
import { SHOWCASE_PIECES_NOTE } from '../showcase.js';
import { GAME_B2, GAME_B2_ID } from './index.js';
import { SPRITE_CATALOG } from './level/schema.js';
import { GAME_B2_SHOWCASE, GAME_B2_SHOWCASE_LINE } from './showcase.js';

/** The mockup film's pieces as words (the line is the only place they may appear). */
const PIECES: readonly RegExp[] = [
  /cartridge/i,
  /\bclerks?\b/i,
  /sand-pile/i,
  /\bcartons?\b/i,
  /'office'|'warehouse'/,
  /E\.T\./,
];

type Factory = (params: Record<string, unknown>) => Record<string, (...args: unknown[]) => unknown>;

function view(params: Record<string, unknown>): Record<string, (...args: unknown[]) => unknown> {
  const fx: Readonly<Record<string, unknown>> = createKit({
    three: THREE,
    palette: {},
    rng: testRng(3),
    style: GAME_B2_ID,
  }).api.fx;
  const make = fx['b2View'];
  if (typeof make !== 'function') throw new Error('kit.fx.b2View is not bound');
  return (make as Factory)(params);
}

/** Everything kit-docs and the scene prompt get from the Game B2 kit. */
function docsText(): string {
  const catalog = kitCatalog([], LOOKS, { style: GAME_B2_ID, experimental: true });
  const looks = GAME_B2.looks.map((look) => `${look.description}\n${look.docs}`);
  return [JSON.stringify(catalog.fx), ...looks].join('\n');
}

describe('Game B2 showcase pieces', () => {
  it('are marked in the sprite catalog and named in one line', () => {
    expect(SPRITE_CATALOG.filter((piece) => piece.showcase).map((piece) => piece.id)).toEqual([
      'sand-pile',
      'carton',
      'clerk',
      'item',
    ]);
    expect(GAME_B2_SHOWCASE_LINE.startsWith(SHOWCASE_PIECES_NOTE)).toBe(true);
    for (const id of [...GAME_B2_SHOWCASE.levels, ...GAME_B2_SHOWCASE.sprites])
      expect(GAME_B2_SHOWCASE_LINE).toContain(id);
  });

  it('appear in kit-docs and the look docs only inside the showcase line', () => {
    const text = docsText();
    expect(text).toContain(GAME_B2_SHOWCASE_LINE);
    const rest = text.split(GAME_B2_SHOWCASE_LINE).join(' ');
    expect(PIECES.filter((piece) => piece.test(rest)).map(String)).toEqual([]);
  });

  it('stay usable on request, but an item needs its own look and a level name must exist', () => {
    const path = [{ at: 0, x: 2.5, y: 8.5, yaw: 0 }];
    const showcase = view({ level: 'warehouse', stencil: 'MAP', path, seed: 1 });
    showcase['hold']?.({ kind: 'cartridge', label: 'MAP' }, { at: 0 });
    expect(() => showcase['hold']?.({ label: 'MAP' }, { at: 0 })).toThrow(
      /item: give it the film's own look, \{ icon: 'ledger' \}/,
    );
    expect(() => view({ level: 'forest', path })).toThrow(/write the film's own level object/);
  });
});
