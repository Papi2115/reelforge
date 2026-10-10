/**
 * Topic bias of the Grim Ink prompts (PLAN.md#14.10, docs/worlds/DECISIONS.md "a world is a style
 * GRAMMAR"): the three C-CAM showcase films (Edo samurai in debt, the 1268 papal election in
 * Viterbo, the Apollo 11 landing) are style references, never content. Every Grim Ink prompt text
 * (the world wording, the moment catalog, the API snippets, and the storyboard, scene-build,
 * scene-fix and critic prompts as rendered for every moment) is scanned for their nouns; a hit
 * fails unless it sits in the one allowed sentence, a short "Pitfalls seen in real films: …" line.
 */
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import {
  C_CAM_SNIPPETS,
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
} from './worlds/index.js';

/** Nouns of the three showcase films (cast, places, props, gags, titles). */
const SHOWCASE: readonly RegExp[] = [
  // Film 1: Edo samurai.
  /samurai/i,
  /\bedo\b/i,
  /shogun/i,
  /daimyo/i,
  /\bronin\b/i,
  /katana|\bswords?\b|scabbard/i,
  /\bkoban\b/i,
  /\brice\b/i,
  /merchant/i,
  /tatami|shoji|noren|futon|jingasa/i,
  /\bbow(?:s|ed|ing)? lower\b/i,
  /\bCLACK\b/,
  /\bcat\b/i,
  // Film 2: the papal conclave of 1268.
  /\bpopes?\b|\bpapal\b|conclave|cardinals?\b/i,
  /viterbo/i,
  /\bgregory\b/i,
  /\b12(?:68|71)\b/,
  /cum clave|tiara|chalice/i,
  /\broofer\b|\bthe roof\b/i,
  /\bmayor\b/i,
  /grievances/i,
  // Film 3: Apollo 11.
  /apollo/i,
  /\beagle\b/i,
  /lunar/i,
  /\blander\b/i,
  /\bmoon\b/i,
  /\bDSKY\b/i,
  /\b120[12]\b/,
  /houston|armstrong|aldrin|collins/i,
  /astronaut/i,
  /mission control/i,
  /\bboulders?\b/i,
  /\bfuel\b/i,
  /\bgum\b/i,
  /\b1969\b/,
  // The films' shared format.
  /would you survive/i,
  /survival tip/i,
];

/** The one sentence that may name a real film's pitfalls (<= 300 characters). */
const ALLOWED = /Pitfalls seen in real films:[^.]{0,300}\./g;

/** Showcase nouns of a text outside the allowed sentence. */
function showcaseNouns(text: string): string[] {
  const rest = text.replace(ALLOWED, ' ');
  return SHOWCASE.flatMap((pattern) => {
    const match = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`).exec(rest);
    return match === null ? [] : [match[0]];
  });
}

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

const text = worldPromptText('c-cam');
if (text === undefined) throw new Error('no c-cam prompt text');
const GRIM: PromptWorld = { label: 'Grim Ink', text };
const MOMENTS = [undefined, ...text.moments.map((moment) => moment.id)];

/** Every Grim Ink prompt as the stages will render it, on a neutral topic (a river town). */
function grimPrompts(): Map<string, string> {
  const out = new Map<string, string>([
    ['world text', JSON.stringify(text)],
    ['snippets', JSON.stringify(C_CAM_SNIPPETS)],
    ['script surprise', scriptWorldVars(GRIM)['worldSurprise'] ?? ''],
    [
      'storyboard',
      rendered('storyboard', {
        styleId: 'c-cam',
        looks: '- `ink-scene` (Ink scene): the scene. Rolls: A.',
        multiLook: true,
        interrupts: true,
        interruptRules: 'Plan 1–2 interrupts.',
        continuityLinks: true,
        continuityBudget: 2,
        ...storyboardWorldVars(GRIM, 'ink-scene', [], { durationS: 155 }),
      }),
    ],
  ]);
  for (const moment of MOMENTS) {
    const name = moment ?? 'plain';
    out.set(
      `scene-build ${name}`,
      rendered('scene-build', {
        shotId: 's02_river',
        shotScene: 'scenes/s02_river.js',
        shotJson: { id: 's02_river', t0: 4, t1: 9, treatment: 'character-scene' },
        shotWords: [{ text: 'river', t: 4.4, tEnd: 4.9 }],
        neighbours: [],
        styleId: 'c-cam',
        lookId: 'ink-scene',
        lookDocs: 'Look `ink-scene` (world Grim Ink, A roll).',
        ...sceneWorldVars(GRIM, moment),
      }),
    );
    out.set(
      `scene-fix ${name}`,
      rendered('scene-fix', {
        scope: 'Shot',
        shotIds: 's02_river',
        request: 'QA fix 1/2 for shot s02_river.',
        ...fixWorldVars(GRIM, 'ink-scene', moment),
      }),
    );
    out.set(
      `critic ${name}`,
      rendered('critic', {
        styleId: 'c-cam',
        imagePaths: '.reelforge/qa/s02_river/build-1.png',
        intent: 'The river rises over the lower town.',
        lookId: 'ink-scene',
        roll: 'A',
        lookRules: 'Ink scene: people in a grimy place.',
        ...criticWorldVars(GRIM, moment),
      }),
    );
  }
  return out;
}

describe('Grim Ink prompts carry the style grammar, not the showcase films', () => {
  it('name no showcase noun in any Grim Ink prompt', () => {
    const found = [...grimPrompts()].flatMap(([name, prompt]) =>
      showcaseNouns(prompt).map((noun) => `${name}: ${noun}`),
    );
    expect(found).toEqual([]);
  });

  it('catch a planted showcase noun outside the pitfalls sentence, and only there', () => {
    expect(showcaseNouns('Draw the merchant counting koban.')).toEqual(['koban', 'merchant']);
    expect(showcaseNouns('e.g. `env.ink.drawText("1202", …)`')).toEqual(['1202']);
    expect(
      showcaseNouns('Pitfalls seen in real films: the cardinal arms out of his jowls. Go on.'),
    ).toEqual([]);
    expect(
      showcaseNouns('Pitfalls seen in real films: arms out of the jowls. Then the pope speaks.'),
    ).toEqual(['pope']);
  });
});
