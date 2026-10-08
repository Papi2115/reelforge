/**
 * Topic bias guard of the Sketchbook prompts (PLAN.md#13.15 phase 2, docs/worlds/DECISIONS.md
 * "PRINCIPLE: a world is a style GRAMMAR"): the first real films replayed the showcase's content
 * (its calendar, its emperor and pope, the sun swinging on an arm) because the prompts quoted it.
 * Every text the runtime Claude gets for a Sketchbook project (storyboard, scene-build, scene-fix
 * and critic for every planned moment, the script's surprise wording, the world texts and the kit
 * snippets) is scanned for the nouns of the showcase and of the earlier test films; a hit outside
 * an allowlisted sentence fails, so the bias cannot creep back.
 */
import { describe, expect, it } from 'vitest';
import { renderPrompt, type PromptId } from './catalog.js';
import type { TemplateVars } from './template.js';
import {
  criticWorldVars,
  fixWorldVars,
  sceneWorldVars,
  scriptWorldVars,
  SKETCHBOOK_SNIPPETS,
  storyboardWorldVars,
  worldPromptText,
  type PromptWorld,
} from './worlds/index.js';

/** Nouns of the showcase (docs/worlds/sketchbook-v2) and of the real test films 1-3. */
const BIASED_NOUNS: readonly RegExp[] = [
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
  // Test film 1 (an emu war), 2 (a dancing plague), 3 (a molasses flood).
  /\bemus?\b/i,
  /\bdanc(?:e|ers?|ing)\b/i,
  /\bvitus\b/i,
  /\b1518\b/,
  /\bmolasses\b/i,
  /\b1919\b/,
  /\bboston\b/i,
];

/**
 * Sentences that may name one of them, each with its reason. Every entry must still occur in the
 * scanned texts (a stale entry fails too).
 */
const ALLOWED: readonly { readonly text: string; readonly why: string }[] = [
  {
    text: 'Add to the second shot `"continuity": { "kind": "zoom-through", "object": "wall calendar"',
    why: "storyboard.md's shared continuity example (every world and the voxel mode), not Sketchbook wording",
  },
  {
    text: 'the wall calendar becomes the year it shows',
    why: "storyboard.md's shared continuity example",
  },
  {
    text: 'say in both intents how the object carries over ("ends on the wall calendar" / "opens on the wall calendar page")',
    why: "storyboard.md's shared continuity example",
  },
];

const text = worldPromptText('sketchbook');
if (text === undefined) throw new Error('no sketchbook prompt text');
const WORLD: PromptWorld = { label: 'Sketchbook', text };
const TRANSITIONS = [
  { id: 'sketchbook-page-flip', type: 'wipe', duration: 0.62, description: 'the page turns' },
  { id: 'sketchbook-torn-strip', type: 'wipe', duration: 0.8, description: 'torn out' },
];
const MOMENTS = [undefined, ...text.moments.map((moment) => moment.id)];
const SHOT = { id: 's03_x', t0: 4, t1: 9, treatment: 'metaphor-object', look: 'sketch-story' };

function rendered(id: PromptId, vars: TemplateVars): string {
  const result = renderPrompt(id, vars);
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

/** Every Sketchbook text the runtime Claude can get: name -> text. */
function sketchbookTexts(): Map<string, string> {
  const texts = new Map<string, string>();
  texts.set(
    'storyboard',
    rendered('storyboard', {
      styleId: 'sketchbook',
      looks: '- `sketch-story` (Sketch story)',
      multiLook: true,
      maxTransitions: '3',
      tension: '- 0:00–0:20 calm',
      interrupts: true,
      interruptRules: 'Plan 1–2 interrupts.',
      continuityLinks: true,
      continuityBudget: 2,
      ...storyboardWorldVars(WORLD, 'sketch-story', TRANSITIONS, { durationS: 155 }),
    }),
  );
  texts.set('script surprise', scriptWorldVars(WORLD)['worldSurprise'] ?? '');
  for (const moment of MOMENTS) {
    const name = moment ?? 'plain';
    texts.set(
      `scene-build (${name})`,
      rendered('scene-build', {
        shotId: SHOT.id,
        shotScene: 'scenes/s03_x.js',
        shotJson: SHOT,
        shotWords: [],
        neighbours: [],
        styleId: 'sketchbook',
        lookId: 'sketch-story',
        lookDocs: '<lookDocs>',
        annotationPlan: '<annotationPlan>',
        ...sceneWorldVars(WORLD, moment),
      }),
    );
    texts.set(
      `scene-fix (${name})`,
      rendered('scene-fix', {
        scope: 'Shot',
        shotIds: SHOT.id,
        request: '<request>',
        ...fixWorldVars(WORLD, 'sketch-story', moment),
      }),
    );
    texts.set(
      `critic (${name})`,
      rendered('critic', {
        styleId: 'sketchbook',
        imagePaths: 'a.png',
        intent: '<intent>',
        lookId: 'sketch-story',
        roll: 'A',
        lookRules: '<lookRules>',
        ...criticWorldVars(WORLD, moment),
      }),
    );
  }
  texts.set('world texts', JSON.stringify(text));
  texts.set('snippets', JSON.stringify(SKETCHBOOK_SNIPPETS));
  return texts;
}

function withoutAllowed(value: string): string {
  return ALLOWED.reduce((rest, entry) => rest.replaceAll(entry.text, ' '), value);
}

/** `name: …context…` for every biased noun in a text. */
function hits(name: string, value: string): string[] {
  const clean = withoutAllowed(value);
  return BIASED_NOUNS.flatMap((noun) =>
    [...clean.matchAll(new RegExp(noun.source, `${noun.flags}g`))].map((match) => {
      const at = match.index;
      return `${name}: "${match[0]}" in …${clean.slice(Math.max(0, at - 50), at + 50)}…`;
    }),
  );
}

describe('Sketchbook prompts carry the style grammar, not the showcase topic', () => {
  const texts = sketchbookTexts();

  it('scan every rendered prompt, the world texts and the snippets', () => {
    expect(texts.size).toBe(4 + MOMENTS.length * 3);
    for (const value of texts.values()) expect(value.length).toBeGreaterThan(40);
  });

  it('name no showcase or test-film noun outside an allowlisted sentence', () => {
    expect([...texts].flatMap(([name, value]) => hits(name, value))).toEqual([]);
  });

  it('keep no stale allowlist entry', () => {
    const all = [...texts.values()].join('\n');
    expect(ALLOWED.filter((entry) => !all.includes(entry.text)).map((entry) => entry.why)).toEqual(
      [],
    );
  });

  it('would catch a showcase noun planted in the wording', () => {
    const planted = `${text.motion} (the sun slides off its notch, so the calendar drifts)`;
    expect(hits('motion', planted)).toHaveLength(2);
    expect(hits('snippet', "page.write('1582', { x: 1 })")).toHaveLength(1);
  });
});
