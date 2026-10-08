/**
 * Topic bias of the Game B2 prompts (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md "PRINCIPLE: a
 * world is a style GRAMMAR"): the real run Game B2 1 replayed the showcase (a literal cartridge in a
 * film about the Great Stink, a ledger drawn as a cartridge, every person the same clerk). Every
 * text the runtime Claude gets in a Game B2 project (storyboard, scene-build / scene-fix / critic
 * for every planned moment and for a plain shot, the script with its game framing, every world field
 * and every quoted kit call) is scanned for the showcase's nouns; they may appear only in the
 * allowlisted sentences below.
 */
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import {
  criticWorldVars,
  fixWorldVars,
  GAME_B2_SNIPPETS,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
  type WorldTransitionOption,
} from './worlds/index.js';
import { GAME_B2_PITFALLS } from './worlds/game-b2.js';
import { GAME_B2_STRUCTURE } from './worlds/game-b2-script.js';

/** The only sentences that may name the showcase's things (changing them is deliberate). */
const ALLOWED_SENTENCES: readonly string[] = [
  // The world's own warning (game-b2.ts `GAME_B2_PITFALLS`).
  GAME_B2_PITFALLS,
  // The shared storyboard template's continuity example (prompts/storyboard.md, every world).
  'one cartridge pulled out, another pushed in',
];

/** The showcase's nouns (the 1983 crash film, docs/worlds/game-hud-b2-rpg-v2). */
const SHOWCASE: readonly RegExp[] = [
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
];

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const text = worldPromptText('game-b2');
if (text === undefined) throw new Error('no game-b2 prompt text');
const GAME: PromptWorld = { label: 'Game B2: first-person RPG', text };
const TRANSITIONS: readonly WorldTransitionOption[] = Object.entries({
  melt: 0.7,
  fog: 1.4,
  darkness: 1,
  door: 0.9,
  'level-card': 1,
  'map-unfold': 0.6,
  'map-fold': 0.9,
}).map(([name, duration]) => ({
  id: `game-b2-${name}`,
  type: 'wipe',
  duration,
  description: name,
}));
const LOOKS =
  "- `rpg-explore` (RPG explore): the walk.\n- `rpg-menu` (RPG menu): the game's screens.\n- `rpg-boss` (RPG boss): the pressure.";
const MOMENTS = [undefined, ...text.moments.map((entry) => entry.id)];

/** Every Game B2 prompt text, named. */
function texts(): [string, string][] {
  const all: [string, string][] = [
    [
      'storyboard',
      rendered('storyboard', {
        styleId: 'game-b2',
        looks: LOOKS,
        multiLook: true,
        maxTransitions: '4',
        interrupts: true,
        interruptRules: 'Plan 1–2 interrupts.',
        continuityLinks: true,
        continuityBudget: 2,
        ...storyboardWorldVars(GAME, 'rpg-explore', TRANSITIONS, { durationS: 150 }),
      }),
    ],
    ['script surprise', scriptWorldVars(GAME)['worldSurprise'] ?? ''],
    [
      'script',
      rendered('script', {
        brief: { version: 1, topic: 'How a thing works', language: 'en', targetMinutes: 6 },
        language: 'en',
        targetMinutes: 6,
        targetWords: 900,
        tone: 'friendly',
        audience: 'not specified',
        surpriseBeats: true,
        interruptsPerMinute: '1–2',
        ...scriptWorldVars(GAME),
      }),
    ],
    ['world fields', JSON.stringify(text)],
    ['snippets', JSON.stringify(GAME_B2_SNIPPETS)],
  ];
  for (const moment of MOMENTS) {
    const name = moment ?? 'plain';
    all.push([
      `scene-build ${name}`,
      rendered('scene-build', {
        shotId: 's05_walk',
        shotScene: 'scenes/s05_walk.js',
        shotJson: { id: 's05_walk', t0: 20, t1: 26 },
        shotWords: [{ text: 'river', t: 21, tEnd: 21.4 }],
        neighbours: [],
        styleId: 'game-b2',
        lookId: 'rpg-explore',
        lookDocs: 'Look `rpg-explore` (world Game B2, A roll): the walk.',
        ...sceneWorldVars(GAME, moment),
      }),
    ]);
    all.push([
      `scene-fix ${name}`,
      rendered('scene-fix', {
        scope: 'Shot',
        shotIds: 's05_walk',
        request: 'QA fix 1/2 for shot s05_walk.',
        ...fixWorldVars(GAME, 'rpg-explore', moment),
      }),
    ]);
    all.push([
      `critic ${name}`,
      rendered('critic', {
        styleId: 'game-b2',
        imagePaths: '.reelforge/qa/s05_walk/build-1.png',
        intent: 'The walk along the river to the mill.',
        lookId: 'rpg-explore',
        roll: 'A',
        lookRules: 'RPG explore: the walk.',
        ...criticWorldVars(GAME, moment),
      }),
    ]);
  }
  return all;
}

/** Showcase nouns of a text outside the allowed sentences, with some context. */
function showcaseHits(name: string, value: string): string[] {
  const rest = ALLOWED_SENTENCES.reduce((left, sentence) => left.split(sentence).join(' '), value);
  return SHOWCASE.flatMap((noun) =>
    [...rest.matchAll(new RegExp(noun.source, `${noun.flags}g`))].map((match) => {
      const at = match.index;
      return `${name}: "${match[0]}" in …${rest.slice(Math.max(0, at - 50), at + 50)}…`;
    }),
  );
}

describe('Game B2 prompts are free of the showcase topic', () => {
  it('name no showcase noun outside the allowlisted sentences', () => {
    const all = texts();
    expect(all.length).toBe(5 + MOMENTS.length * 3);
    expect(all.flatMap(([name, value]) => showcaseHits(name, value))).toEqual([]);
  });

  it('keep the game framing free of the real-run topics (forest film, compound interest)', () => {
    const framing = [text.script ?? '', GAME_B2_STRUCTURE].join('\n');
    expect(framing.length).toBeGreaterThan(1_000);
    expect(framing).not.toMatch(
      /forest|\boaks?\b|acorn|\btrees?\b|ecosystem|interest|\bstink\b|sewer|thames|london/i,
    );
  });

  it('would catch a planted showcase noun (the scan is live)', () => {
    expect(showcaseHits('probe', 'the hand takes the cartridge from the clerk')).toHaveLength(2);
    expect(showcaseHits('probe', 'E.T. sells poorly in 1983')).toHaveLength(2);
    expect(showcaseHits('probe', 'a sprite of the warehouse shelf')).toHaveLength(1);
    expect(showcaseHits('probe', GAME_B2_PITFALLS)).toEqual([]);
  });

  it('keeps the pitfalls sentence in the scene turn', () => {
    const build = texts().find(([name]) => name === 'scene-build plain')?.[1] ?? '';
    expect(build).toContain(GAME_B2_PITFALLS);
    expect(GAME_B2_PITFALLS).toMatch(/never draw a cartridge or a clerk unless the narration/);
  });
});
