/**
 * Game B2 craft guards (real run Game B2 2): numbers popping off nothing, a web address on screen,
 * the same menu layout twice, a film ending on black, a linked item that blinks at the seam; the
 * craft the guards ask for passes clean.
 */
import { describe, expect, it } from 'vitest';
import { b2CraftFindings, b2FilmFindings } from './game-b2-craft.js';
import { parseScene } from './source-text.js';
import type { ShotEntry, ShotProgram } from './world-labels.js';

function program(body: string) {
  const parsed = parseScene(
    `export const meta = { id: 'x', title: 'SEE WWW.EXAMPLE.COM' };\nexport function build(ctx) {\n${body}\n}`,
  );
  if (parsed === undefined) throw new Error('does not parse');
  return parsed;
}

const shot = (shotId: string, body: string, entry: ShotEntry = 'cut'): ShotProgram => ({
  shotId,
  program: program(body),
  entry,
});

const messages = (found: Map<string, { message: string }[]>, id: string): string =>
  (found.get(id) ?? []).map((entry) => entry.message).join('\n');

describe('b2CraftFindings', () => {
  it('flags damage numbers with no meter or boss bar, not those off a boss bar', () => {
    const loose = b2CraftFindings(
      program("hud.damage({ text: '2', at: 1, pos: [372, 128] });"),
      's06.js',
    );
    expect(loose.map((entry) => entry.message).join()).toMatch(
      /numbers popping off nothing \(s06\.js:3\)/,
    );
    const meant = program(
      "hud.boss({ name: 'THE FLOOD', keys: [[0, 0.2]] }); hud.damage({ text: '-3', at: 1, on: 'boss' });",
    );
    expect(b2CraftFindings(meant, 's07.js')).toEqual([]);
  });

  it('flags a web address in the HUD but not in meta or an intent', () => {
    const found = b2CraftFindings(program("hud.menu({ note: 'SCIENCEALERT.COM' });"), 's04.js');
    expect(found.map((entry) => entry.message).join()).toMatch(
      /web address on screen \("SCIENCEALERT\.COM"\)/,
    );
    const planned = program(
      "view.automap({ intent: 'as www.example.org shows, the map', at: 0 });",
    );
    expect(b2CraftFindings(planned, 's05.js')).toEqual([]);
  });
});

describe('b2FilmFindings', () => {
  const QUEST =
    "hud.menu({ at: 0, until: 4, quest: { now: 'A', objective: 'B', done: [] }, inventory: { items: [] } });";

  it('flags the second menu of the same layout, not a stat sheet', () => {
    const found = b2FilmFindings([
      shot('s02', QUEST),
      shot('s03', "hud.menu({ at: 0, until: 4, stats: { title: 'C', rows: [] } });"),
      shot('s04', QUEST),
    ]);
    expect(messages(found, 's04')).toMatch(/same full-frame menu \(quest \+ inventory\) as s02/);
    expect(found.has('s02')).toBe(false);
    expect(found.has('s03')).toBe(false);
  });

  it('flags a film ending on a map over black, not a frozen one or an earlier one', () => {
    const black = "view.automap({ intent: 'x', at: 0, until: 3, exit: 'cut' });";
    expect(messages(b2FilmFindings([shot('s09', ''), shot('s10', black)]), 's10')).toMatch(
      /ends on a black screen \(an automap cut over black/,
    );
    const frozen =
      "view.automap({ intent: 'x', at: 0, until: 3, exit: 'cut', backdrop: 'freeze' });";
    expect(b2FilmFindings([shot('s09', black), shot('s10', frozen)]).size).toBe(0);
    const dark = "hud.tally({ intent: 'x', at: 0, until: 3, backdrop: 'dark' });";
    expect(messages(b2FilmFindings([shot('s10', dark)]), 's10')).toMatch(/a tally on 'dark'/);
  });

  it('flags a linked item missing or lowered at the seam', () => {
    const opens = "view.hold({ icon: 'acorn' }, { at: -1 });";
    const lowered = "view.take({ icon: 'acorn' }, { at: 1, from: [1, 1, 0], until: 3 });";
    expect(
      messages(b2FilmFindings([shot('s06', lowered), shot('s07', opens, 'link')]), 's07'),
    ).toMatch(/blinks at the seam: s07 opens holding 'acorn' but s06 lowers it before the cut/);
    expect(messages(b2FilmFindings([shot('s06', ''), shot('s07', opens, 'link')]), 's07')).toMatch(
      /s06 never puts it in the hand/,
    );
    const held = "view.take({ icon: 'acorn' }, { at: 1, from: [1, 1, 0] });";
    expect(b2FilmFindings([shot('s06', held), shot('s07', opens, 'link')]).size).toBe(0);
    expect(b2FilmFindings([shot('s06', ''), shot('s07', opens, 'cut')]).size).toBe(0);
  });
});
