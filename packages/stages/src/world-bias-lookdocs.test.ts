/**
 * Topic bias of the kit's look docs (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md "PRINCIPLE: a
 * world is a style GRAMMAR"). The prompts' own bias tests (packages/prompts/src/*-bias.test.ts)
 * scan the world wording with a stub for `lookDocs`; the prompts package cannot import the kit, so
 * this test scans what the kit really hands the runtime Claude for every look of every world: the
 * scene-build `lookDocs` (as `sceneLookVars` produces them), the storyboard's look line and the
 * critic's look rules (`CRITIC_LOOK_RULES`). A showcase noun may appear only in a world's one
 * "Showcase pieces (…)" line, and no text may name a showcase example file (the runtime Claude
 * cannot read them). The noun lists follow the prompts' bias tests of each world.
 */
import type { Look } from '@reelforge/kit';
import type { StoryboardShot } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { CRITIC_LOOK_RULES, lookLine, sceneLookVars, styleLooks } from './looks.js';

/** The one allowed place for a showcase noun: the kit's showcase line (ends with the line). */
const SHOWCASE_LINE = /Showcase pieces \(do not use unless the narration is about them\):[^\n]*/g;

/** A showcase example file (`s1_spread_….js`, `a2_xmas.js`, `c3-c7 in kit-docs`). */
const EXAMPLE_FILES: readonly RegExp[] = [
  /\b[a-z]\d+_[a-z0-9_]+\.js\b/i,
  /\bexamples? [a-z]\d/i,
  /\b[a-z]\d-[a-z]\d in kit-docs\b/i,
];

/** Nouns of each world's showcase and test films (the prompts' bias tests). */
const NOUNS: Readonly<Record<string, readonly RegExp[]>> = {
  sketchbook: [
    /\bleap\b/i,
    /\bcalendars?\b/i,
    /\bcaesar/i,
    /\bgregor(?:y|ian)\b/i,
    /\bjulian\b/i,
    /\bequinox/i,
    /\borbit/i,
    /\bsun\b/i,
    /\bpope\b/i,
    /\bbritain\b/i,
    /\b365\b/,
    /\b1582\b/,
    /\b1752\b/,
    /\b45 BC\b/i,
    /\bfeb(?:ruary)? 29\b/i,
    /\bemus?\b/i,
    /\bdanc(?:e|ers?|ing)\b/i,
    /\bvitus\b/i,
    /\b1518\b/,
    /\bmolasses\b/i,
    /\b1919\b/,
    /\bboston\b/i,
  ],
  comic: [
    /apollo/i,
    /\beagle\b/i,
    /lunar/i,
    /\blander\b/i,
    /\bLM\b/,
    /\bDSKY\b/i,
    /\b120[12]\b/,
    /\bbales\b/i,
    /\bmoon\b/i,
    /tranquil/i,
    /houston/i,
    /armstrong/i,
    /capcom/i,
    /mission control/i,
    /\b19(?:47|53|61|69)\b/,
    /\babort\b/i,
    /no-go/i,
    /touchdown/i,
    /contact light/i,
    /engine (?:stop|cut)/i,
    /sixty seconds/i,
    /decade was out/i,
    /piltdown/i,
    /dawson/i,
    /fluorine/i,
    /orangutan/i,
    /mark ii/i,
    /harvard/i,
    /\bmoth\b/i,
    /\brelay\b/i,
    /logbook/i,
    /everest/i,
    /hillary/i,
    /tenzing/i,
    /\bsummit\b/i,
  ],
  'game-b2': [
    /\bE\.T\b|\bET\b/,
    /cartridge/i,
    /\batari\b/i,
    /\bclerks?\b/i,
    /store[- ]shelf|toy store|bargain bin|\bstores?\b/i,
    /returns (?:desk|pile)|\bthe returns\b/i,
    /warehouse/i,
    /landfill|alamogordo|new mexico/i,
    /\b198[2-5]\b/,
    /three million|4,000,000|1,500,000/i,
    /christmas|xmas/i,
    /unsold/i,
    /programmer/i,
    /\bclones?\b/i,
    /sand-pile|\bcartons?\b/i,
  ],
  'game-b1': [
    /\bE\.T\b|\bET\b/,
    /cartridge/i,
    /\b198[23]\b/,
    /christmas|xmas/i,
    /atari crash|video game crash/i,
    /alamogordo|new mexico|landfill/i,
    /phone home/i,
    /\bdad\b|sleeve/i,
    /\bbur(?:y|ied|ial|ying)\b/i,
    /look-alike|quality control/i,
    /\bNES\b/,
    /sputnik|gagarin|apollo|pyramid scheme/i,
    /\bthe flood\b|\bthe deadline\b/i,
  ],
};

const SHOT: StoryboardShot = {
  id: 's03_x',
  t0: 4,
  t1: 9,
  intent: 'the walk to the river',
  treatment: 'character-scene',
  scene: 'scenes/s03_x.js',
};

/** What the kit hands the runtime Claude for one look: name -> text. */
function lookTexts(look: Look, looks: readonly Look[]): [string, string][] {
  const vars = sceneLookVars('mixed', { ...SHOT, look: look.id }, looks);
  return [
    [`${look.id} lookDocs`, vars['lookDocs'] ?? ''],
    [`${look.id} storyboard line`, lookLine(look)],
    [`${look.id} critic rules`, CRITIC_LOOK_RULES[look.id] ?? ''],
  ];
}

/** `name: "match" in …context…` for every hit outside the showcase line. */
function hits(name: string, text: string, nouns: readonly RegExp[]): string[] {
  const rest = text.replace(SHOWCASE_LINE, ' ');
  return [...nouns, ...EXAMPLE_FILES].flatMap((noun) =>
    [...rest.matchAll(new RegExp(noun.source, `${noun.flags}g`))].map((match) => {
      const at = match.index;
      return `${name}: "${match[0]}" in …${rest.slice(Math.max(0, at - 50), at + 50)}…`;
    }),
  );
}

describe.each(Object.entries(NOUNS))('%s: the real look docs of the kit', (world, nouns) => {
  const looks = styleLooks(world, { experimental: true });

  it('has its three looks, each with build docs', () => {
    expect(looks).toHaveLength(3);
    for (const look of looks) {
      expect(sceneLookVars('mixed', { ...SHOT, look: look.id }, looks)['lookId']).toBe(look.id);
      expect(look.docs.length, look.id).toBeGreaterThan(400);
    }
  });

  it('names no showcase noun or example file outside the showcase line', () => {
    const found = looks.flatMap((look) =>
      lookTexts(look, looks).flatMap(([name, text]) => hits(name, text, nouns)),
    );
    expect(found).toEqual([]);
  });
});

describe('the look-docs scan', () => {
  it('is live: it catches a planted noun or file name, and spares the showcase line', () => {
    const b2 = NOUNS['game-b2'] ?? [];
    expect(hits('probe', 'the hand takes the cartridge from the clerk', b2)).toHaveLength(2);
    expect(hits('probe', 'inspiration: examples s1_spread_valley.js', [])).toHaveLength(2);
    expect(
      hits(
        'probe',
        "Walk the level.\nShowcase pieces (do not use unless the narration is about them): sprites clerk; item kind 'cartridge'.",
        b2,
      ),
    ).toEqual([]);
  });
});
