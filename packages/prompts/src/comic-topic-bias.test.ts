/**
 * Topic bias of the Comic prompts (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md "a world is a
 * style GRAMMAR"): the showcase (comic-panels-v2: the Moon landing) and the first real film are
 * style references, never content. Every Comic prompt text (the world wording, the moment catalog,
 * the quoted kit calls, and the storyboard, scene-build, scene-fix and critic prompts as rendered
 * for every moment) is scanned for their nouns; a hit fails unless it sits in the one allowed
 * sentence, a short "Pitfalls seen in real films: …" line.
 */
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import {
  COMIC_SNIPPETS,
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  scriptWorldVars,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
} from './worlds/index.js';

/** Nouns of the showcase film and of the real-run topics (Apollo 11, Piltdown, the Mark II bug, Everest). */
const SHOWCASE: readonly RegExp[] = [
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
];

/** The one sentence that may name a real film's pitfalls (≤ 300 characters). */
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

const text = worldPromptText('comic');
if (text === undefined) throw new Error('no comic prompt text');
const COMIC: PromptWorld = { label: 'Comic', text };
const MOMENTS = [undefined, ...text.moments.map((moment) => moment.id)];
const TRANSITIONS = [
  { id: 'comic-page-turn', type: 'wipe', duration: 0.9, description: 'the page turns' },
];

/** Every Comic prompt as the stages render it, on a neutral topic (a river town). */
function comicPrompts(): Map<string, string> {
  const out = new Map<string, string>([
    ['world text', JSON.stringify(text)],
    ['snippets', JSON.stringify(COMIC_SNIPPETS)],
    ['script surprise', scriptWorldVars(COMIC)['worldSurprise'] ?? ''],
    [
      'storyboard',
      rendered('storyboard', {
        styleId: 'comic',
        looks: '- `comic-story` (Comic story): story panels. Rolls: A.',
        multiLook: true,
        interrupts: true,
        interruptRules: 'Plan 1–2 interrupts.',
        continuityLinks: true,
        continuityBudget: 2,
        ...storyboardWorldVars(COMIC, 'comic-story', TRANSITIONS, { durationS: 155 }),
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
        styleId: 'comic',
        lookId: 'comic-story',
        lookDocs: 'Look `comic-story` (world Comic, A roll).',
        ...sceneWorldVars(COMIC, moment),
      }),
    );
    out.set(
      `scene-fix ${name}`,
      rendered('scene-fix', {
        scope: 'Shot',
        shotIds: 's02_river',
        request: 'QA fix 1/2 for shot s02_river.',
        ...fixWorldVars(COMIC, 'comic-story', moment),
      }),
    );
    out.set(
      `critic ${name}`,
      rendered('critic', {
        styleId: 'comic',
        imagePaths: '.reelforge/qa/s02_river/build-1.png',
        intent: 'The river rises over the lower town.',
        lookId: 'comic-story',
        roll: 'A',
        lookRules: 'Comic story: panels.',
        ...criticWorldVars(COMIC, moment),
      }),
    );
  }
  return out;
}

describe('Comic prompts carry the style grammar, not the showcase content', () => {
  it('name no showcase noun in any Comic prompt', () => {
    const found = [...comicPrompts()].flatMap(([name, prompt]) =>
      showcaseNouns(prompt).map((noun) => `${name}: ${noun}`),
    );
    expect(found).toEqual([]);
  });

  it('catch a planted showcase noun outside the pitfalls sentence, and only there', () => {
    expect(showcaseNouns('Draw the lunar module with its legs.')).toEqual(['lunar']);
    expect(showcaseNouns('e.g. `page.note("WHY 1202?")`')).toEqual(['1202']);
    expect(
      showcaseNouns('Pitfalls seen in real films: the Piltdown skull drawn as a potato. Go on.'),
    ).toEqual([]);
    expect(
      showcaseNouns(
        'Pitfalls seen in real films: a skull drawn as a potato. Then the Eagle lands.',
      ),
    ).toEqual(['Eagle']);
  });
});
