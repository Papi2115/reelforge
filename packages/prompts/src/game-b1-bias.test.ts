/**
 * Topic bias of the Game B1 prompts (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md "PRINCIPLE: a
 * world is a style GRAMMAR"): the real run Game B1 1 replayed the showcase (a cartridge in unrelated
 * films, the 1982 living room on New Year's Eve 1999). Every text the runtime Claude gets in a Game B1
 * project (storyboard, scene-build / scene-fix / critic for every planned moment and for a plain
 * shot, the script's surprise wording, every world field and every quoted kit call) is scanned for
 * the showcase's nouns; they may appear only in the allowlisted sentences below. Kit API names that
 * contain a showcase word (`screen.cartridge(`, `game-b1-cartridge-in`, the moment id `cartridge`)
 * are identifiers, not instructions, and are removed before the scan.
 */
import type { ContinuityKind } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import {
  criticWorldVars,
  fixWorldVars,
  GAME_B1_SNIPPETS,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
  type WorldTransitionOption,
} from './worlds/index.js';
import { B1_PITFALLS } from './worlds/game-b1.js';

/** The only sentences that may name the showcase's things (changing them is deliberate). */
const ALLOWED_SENTENCES: readonly string[] = [
  // The world's own warning (game-b1.ts `B1_PITFALLS`).
  'Pitfalls seen in real films: no cartridge, E.T., Christmas tree or 1982 living room unless the narration is about one.',
  // The shared storyboard template's continuity example (prompts/storyboard.md, every world).
  'one cartridge pulled out, another pushed in',
];

/** Kit identifiers that contain a showcase word. */
const IDENTIFIERS: readonly RegExp[] = [
  // The engine's own line for its cartridge transitions (what the transition draws).
  /^- `game-b1-cartridge-(?:in|out)` \(.*$/gm,
  // The moment id and the snippet name in the JSON of the world texts.
  /"id":"cartridge"|"cartridge":/g,
  /screen\.cartridge\(/g,
  /game-b1-cartridge-(?:in|out)/g,
  /`cartridge`/g,
  /"worldMoment": "cartridge"/g,
];

/** The showcase's nouns (the 1983 crash film, docs/worlds/game-hud-b1-boss-v2) and its templates. */
const SHOWCASE: readonly RegExp[] = [
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
];

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const text = worldPromptText('game-b1');
if (text === undefined) throw new Error('no game-b1 prompt text');
const GAME: PromptWorld = { label: 'Game B1: Atari boss montage', text };
const LINKS: Readonly<Record<string, ContinuityKind>> = {
  'calendar-zoom': 'zoom-through',
  'cartridge-in': 'carry-environment',
  'cartridge-out': 'carry-environment',
};
const TRANSITIONS: readonly WorldTransitionOption[] = Object.entries({
  'calendar-zoom': 1.2,
  'cartridge-in': 0.8,
  'cartridge-out': 0.9,
  'scanline-wipe': 0.62,
  'page-slide': 0.8,
}).map(([name, duration]) => ({
  id: `game-b1-${name}`,
  type: 'wipe',
  duration,
  description: name,
  ...(LINKS[name] === undefined ? {} : { link: LINKS[name] }),
}));
const LOOKS =
  "- `atari-story` (Atari story): the story.\n- `atari-menu` (Atari menu): the console's screens.";
const MOMENTS = [undefined, ...text.moments.map((entry) => entry.id)];

/** Every Game B1 prompt text, named. */
function texts(): [string, string][] {
  const all: [string, string][] = [
    [
      'storyboard',
      rendered('storyboard', {
        styleId: 'game-b1',
        looks: LOOKS,
        multiLook: true,
        maxTransitions: '4',
        interrupts: true,
        interruptRules: 'Plan 1–2 interrupts.',
        continuityLinks: true,
        continuityBudget: 2,
        ...storyboardWorldVars(GAME, 'atari-story', TRANSITIONS, { durationS: 150 }),
      }),
    ],
    ['script surprise', scriptWorldVars(GAME)['worldSurprise'] ?? ''],
    ['world fields', JSON.stringify(text)],
    ['snippets', JSON.stringify(GAME_B1_SNIPPETS)],
  ];
  for (const moment of MOMENTS) {
    const name = moment ?? 'plain';
    all.push([
      `scene-build ${name}`,
      rendered('scene-build', {
        shotId: 's04',
        shotScene: 'scenes/s04.js',
        shotJson: { id: 's04', t0: 24, t1: 31.5 },
        shotWords: [{ text: 'tide', t: 26.7, tEnd: 27.1 }],
        neighbours: [],
        styleId: 'game-b1',
        lookId: 'atari-story',
        lookDocs: 'Look `atari-story`.',
        annotationPlan: '- "tide" (name): pin TIDE',
        ...sceneWorldVars(GAME, moment),
      }),
    ]);
    all.push([
      `scene-fix ${name}`,
      rendered('scene-fix', {
        scope: 'Shot',
        shotIds: 's04',
        request: 'QA fix 1/2.',
        critic: 'error critic: off-intent',
        ...fixWorldVars(GAME, 'atari-story', moment),
      }),
    ]);
    all.push([
      `critic ${name}`,
      rendered('critic', {
        styleId: 'game-b1',
        imagePaths: '.reelforge/qa/s04/build-1.png',
        intent: 'The tide turns at the point.',
        lookId: 'atari-story',
        roll: 'A',
        lookRules: 'Atari story.',
        ...criticWorldVars(GAME, moment),
      }),
    ]);
  }
  return all;
}

/** The showcase nouns a text still names once the allowed sentences and identifiers are out. */
function showcaseNouns(value: string): string[] {
  let rest = value;
  for (const sentence of ALLOWED_SENTENCES) rest = rest.split(sentence).join(' ');
  for (const identifier of IDENTIFIERS) rest = rest.replace(identifier, ' ');
  return SHOWCASE.flatMap((pattern) => {
    const hit = pattern.exec(rest);
    if (hit === null) return [];
    const at = hit.index;
    return [`${hit[0]} in "…${rest.slice(Math.max(0, at - 60), at + 40)}…"`];
  });
}

describe('Game B1 prompts are not biased towards the showcase', () => {
  it('keeps the allowed pitfalls sentence as the world states it', () => {
    expect(ALLOWED_SENTENCES).toContain(B1_PITFALLS);
  });

  it.each(texts())('%s names no showcase noun outside the allowed sentences', (_, value) => {
    expect(showcaseNouns(value)).toEqual([]);
  });

  it('catches a planted showcase noun (the scan works)', () => {
    for (const planted of [
      'Paint the lit E.T. cartridge on the pile.',
      'a living room at Christmas',
      'the XMAS 82 tag',
      'the landfill in 1983',
      "Dad's knit sleeve",
      'the boss is THE FLOOD',
    ]) {
      expect(showcaseNouns(planted), planted).not.toEqual([]);
    }
    expect(showcaseNouns(`${B1_PITFALLS} Use \`screen.cartridge(\` and \`cartridge\`.`)).toEqual(
      [],
    );
  });

  it('renders the allowed pitfalls sentence where the runtime Claude plans, builds and judges', () => {
    const all = Object.fromEntries(texts());
    for (const name of ['storyboard', 'scene-build plain', 'critic plain']) {
      expect(all[name]).toContain(B1_PITFALLS);
    }
  });
});
