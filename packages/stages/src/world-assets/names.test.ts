/** What a world asset is: blind naming vs its own words, and invented people (real runs B2 2 / B1 2). */
import { describe, expect, it } from 'vitest';
import type { WorldCastEntry } from '@reelforge/shared';
import {
  inventedPeopleFindings,
  isPerson,
  legibilityFinding,
  readsAs,
  wordsOf,
  type AssetFacts,
} from './names.js';

const cast = (id: string, kind: WorldCastEntry['kind'], name: string): WorldCastEntry => ({
  id,
  kind,
  name,
  file: 'assets/game-b2/forest.json',
  shots: [],
});

const keeper: AssetFacts = {
  id: 'keeper',
  section: 'sprites',
  cast: cast('keeper', 'character', "woodland keeper, the film's only person"),
  traits: ['person'],
};
const jay: AssetFacts = {
  id: 'jay',
  section: 'sprites',
  cast: cast('jay', 'animal', 'a jay'),
  traits: ['bird'],
};
const oak: AssetFacts = { id: 'old-oak', section: 'sprites', traits: ['plant', 'deciduous'] };

const OAK_SCRIPT =
  'The old oak has stood in this woodland for three hundred years. Jays bury its acorns.';

describe('world asset names', () => {
  it('splits ids and plurals into singular words', () => {
    expect(wordsOf('oldOak-roots')).toEqual(['old', 'oak', 'root']);
    expect(wordsOf("Astronauts' bunks, men and berries")).toEqual([
      'astronaut',
      'bunk',
      'man',
      'and',
      'berry',
    ]);
  });

  it('accepts a crop named by its name, a trait or its category, never by colour alone', () => {
    expect(readsAs('a blue bird', jay)).toBe(true);
    expect(readsAs('an oak tree', oak)).toBe(true);
    expect(readsAs('a man in a hat', keeper)).toBe(true);
    expect(readsAs('a blue blob', jay)).toBe(false);
    expect(readsAs('a brown shape', oak)).toBe(false);
  });

  it('turns the critic verdict into a finding for the fix turn', () => {
    const where = 'crops-A.png tile A2';
    const ok = { sees: 'a blue bird', legible: true, style: 'ok', note: 'crest reads' };
    expect(legibilityFinding(jay, where, ok)).toBeUndefined();
    expect(legibilityFinding(jay, where, { ...ok, sees: 'a grey dot' })).toBe(
      'jay ("a jay") does not read as itself at film size (crops-A.png tile A2): the critic sees "a grey dot"; make its 2-3 defining features bigger and clearer at film size',
    );
    expect(legibilityFinding(jay, where, { ...ok, legible: false })).toMatch(
      /^jay \("a jay"\) is not legible at film size/,
    );
    expect(
      legibilityFinding(jay, where, { ...ok, style: 'off-style', note: 'smooth gradient' }),
    ).toBe(`jay ("a jay") breaks the world's style (${where}): smooth gradient`);
  });

  it('knows people: figures, person generators, characters that are no animal, role words', () => {
    expect(isPerson(keeper)).toBe(true);
    expect(isPerson({ id: 'ranger', section: 'figures', traits: [] })).toBe(true);
    expect(isPerson({ id: 'clerk', section: 'sprites', traits: [] })).toBe(true);
    expect(isPerson(jay)).toBe(false);
    expect(isPerson(oak)).toBe(false);
    expect(
      isPerson({
        id: 'angler',
        section: 'characters',
        traits: ['fish'],
        cast: cast('angler', 'character', 'anglerfish'),
      }),
    ).toBe(false);
  });

  it('flags a person the narration never names (the B2 keeper), even when a modifier is spoken', () => {
    expect(inventedPeopleFindings(OAK_SCRIPT, [keeper, jay, oak])).toEqual([
      `keeper ("woodland keeper, the film's only person") is a person the narration never mentions (script.txt names no "keeper"): remove it and its cast entry, or show the thing itself; never invent people`,
    ]);
  });

  it('allows the people and roles the script names (plural, proper names, generic people)', () => {
    const astronaut: AssetFacts = {
      id: 'commander',
      section: 'generated',
      cast: cast('commander', 'character', 'astronaut'),
      traits: ['person'],
      role: 'astronaut',
    };
    const kelly: AssetFacts = {
      id: 'kelly',
      section: 'figures',
      cast: cast('kelly', 'character', 'Kelly'),
      traits: [],
    };
    const someone: AssetFacts = { id: 'man', section: 'figures', traits: [] };
    const script = 'Astronauts sleep six hours. Kelly counted sixteen sunrises.';
    expect(inventedPeopleFindings(script, [astronaut, kelly])).toEqual([]);
    expect(inventedPeopleFindings(script, [someone])).toEqual([]);
    expect(inventedPeopleFindings(OAK_SCRIPT, [someone])).toHaveLength(1);
  });
});
