/**
 * The Game B1 showcase pieces (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md "a world is a style
 * GRAMMAR"): `room()` is a plain living room unless a parameter asks for the mockup's
 * decorations (no Christmas calendar, tree, presents, gift or loose carts by default), and the
 * kit-docs text of b1Screen and the look docs name the mockup's pieces (its decorations, the
 * cartridge painter, Dad, its year) only in the one showcase line.
 */
import { describe, expect, it } from 'vitest';
import { kitCatalog } from '../../kit.js';
import { LOOKS } from '../../looks/index.js';
import { SHOWCASE_PIECES_NOTE } from '../showcase.js';
import { GAME_B1, GAME_B1_ID } from './index.js';
import { roomSchema } from './screen/schemas.js';
import { GAME_B1_SHOWCASE_LINE } from './showcase.js';

/** The mockup film's pieces as words (the line is the only place they may appear). */
const PIECES: readonly RegExp[] = [
  /christmas|xmas/i,
  /\bdad\b/i,
  /E\.T\./,
  /\b198[23]\b/,
  /\bcart\(/,
  /missing gift|\bpresents\b/i,
  /'cartridge' \|/,
];

function docsText(): string {
  const catalog = kitCatalog([], LOOKS, { style: GAME_B1_ID, experimental: true });
  const looks = GAME_B1.looks.map((look) => `${look.description}\n${look.docs}`);
  return [JSON.stringify(catalog.fx), ...looks].join('\n');
}

describe('Game B1 showcase pieces', () => {
  it('room() draws a plain living room unless a parameter asks for more', () => {
    const plain = roomSchema.parse({});
    expect(plain).toEqual({ calendar: false, tree: false, lamp: false, carts: 0 });
    expect(roomSchema.parse({ calendar: { month: 'MAY' } }).calendar).toEqual({
      month: 'MAY',
      mark: 0,
    });
    expect(roomSchema.safeParse({ calendar: {} }).success).toBe(false);
  });

  it('appear in kit-docs and the look docs only inside the showcase line', () => {
    expect(GAME_B1_SHOWCASE_LINE.startsWith(SHOWCASE_PIECES_NOTE)).toBe(true);
    const text = docsText();
    expect(text).toContain(GAME_B1_SHOWCASE_LINE);
    const rest = text.split(GAME_B1_SHOWCASE_LINE).join(' ');
    expect(PIECES.filter((piece) => piece.test(rest)).map(String)).toEqual([]);
  });
});
