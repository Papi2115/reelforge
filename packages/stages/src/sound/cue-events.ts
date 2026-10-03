/**
 * Finds the events of a film that may get a sound (pure): shot transitions, what the scenes
 * scheduled with `ctx.sfx.at` (list reveals, counters, typed text, ...), their anchors, spoken
 * numbers, emphasised words, text cards and the end card. Each event becomes a *gesture*: one cue
 * or a designed series (counter ticks, rising list pops, riser + hit) that the director keeps or
 * drops as a whole. Rules (recipes, levels, priorities) come from `cue-rules.ts`.
 */
import { SFX_RECIPES, type SfxRecipe } from '@reelforge/pipeline';
import type { StoryboardShot, Treatment } from '@reelforge/shared';
import type { SceneSfxEvent } from '../types.js';
import { DENSITY, LIST_PITCH_ORDER, type CueEventKind } from './cue-rules.js';

export interface SceneAnchorEvent {
  /** Global time of the spoken anchor (s). */
  readonly t: number;
  readonly phrase: string;
  readonly shotId?: string | undefined;
}

export interface DirectorWord {
  readonly text: string;
  readonly t: number;
  readonly tEnd: number;
}

export interface DirectorInput {
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly DirectorWord[];
  /** Sounds the built scenes scheduled (global seconds). */
  readonly sceneSfx: readonly SceneSfxEvent[];
  /** Anchors the built scenes resolved (global seconds). */
  readonly anchors: readonly SceneAnchorEvent[];
}

export interface EventCue {
  /** Event time (s); the cue starts `leadS` (rule) earlier. */
  readonly t: number;
  readonly kind: CueEventKind;
  /** Recipe of a `scene` event. */
  readonly recipe?: SfxRecipe | undefined;
  /** Index into the rule's `choices`. */
  readonly choice?: number | undefined;
  /** Designed variant (series); never changed by the no-repeat rule. */
  readonly variant?: string | undefined;
  readonly pan?: number | undefined;
  readonly durationS?: number | undefined;
  /** dB on top of the rule (e.g. a crescendo across a series). */
  readonly trimDb?: number | undefined;
}

export interface Gesture {
  readonly shotId: string;
  /** Position among the shot's gestures (seeds the variants). */
  readonly index: number;
  /** Kind that sets the gesture's priority (its first cue's kind unless stated). */
  readonly kind: CueEventKind;
  /** Overrides the rule's priority (a scene's repeated sound). */
  readonly priority?: number | undefined;
  readonly cues: readonly EventCue[];
}

/** Shots that look like flat UI / text: a cut into them gets a swoosh, not a whoosh. */
const UI_LIKE: ReadonlySet<Treatment> = new Set([
  'title-card',
  'kinetic-text',
  'ui-mockup',
  'data-chart-3d',
  'counter/odometer',
]);
const BIG_NUMBER_TREATMENTS: ReadonlySet<Treatment> = new Set([
  'title-card',
  'kinetic-text',
  'data-chart-3d',
  'counter/odometer',
]);
const POP_NAMES = ['pop', 'bubble', 'blip'] as const;
const COUNTER_STEP_NAMES = new Set(['tick', 'tock']);
const COUNTER_FINAL_CHOICE: Readonly<Record<string, number>> = { ding: 0, hit: 1 };
/** A sound (scene or derived) this close to an event already covers it (s). */
const COVER_S = 0.4;
const LIST_MAX_GAP_S = 2.5;
const LIST_PAN = 0.2;
const CUT_PAN = 0.15;
const RISER_MAX_S = 1.4;
const RISER_MIN_S = 0.6;
const COUNTER_DEFAULT_S = 1.5;
const COUNTER_MAX_STEPS = 24;
/** The end card's chime lands after the transition into it has settled. */
const END_CARD_DELAY_S = 0.6;
const NUMBER_WORDS = new Set(
  (
    'two three four five six seven eight nine ten eleven twelve fifteen twenty thirty forty fifty ' +
    'sixty seventy eighty ninety hundred thousand million billion trillion dozen ' +
    'dwa trzy cztery pięć sześć siedem osiem dziewięć dziesięć sto tysiąc tysięcy milion ' +
    'milionów miliard miliardów'
  ).split(' '),
);

const isRecipe = (name: string): name is SfxRecipe =>
  (SFX_RECIPES as readonly string[]).includes(name);

function normalized(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function isNumberWord(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORDS.has(normalized(text));
}

function inShot(shot: StoryboardShot, t: number): boolean {
  return t >= shot.t0 && t < shot.t1;
}

function belongs(shot: StoryboardShot, event: { t: number; shotId?: string | undefined }): boolean {
  return event.shotId === undefined ? inShot(shot, event.t) : event.shotId === shot.id;
}

const near = (times: readonly number[], t: number, within: number): boolean =>
  times.some((other) => Math.abs(other - t) < within);

function transitionGesture(shot: StoryboardShot, shotIndex: number): EventCue {
  const transition = shot.transitionIn ?? { type: 'cut' as const };
  const side = shotIndex % 2 === 0 ? 1 : -1;
  switch (transition.type) {
    case 'cut':
      return {
        t: shot.t0,
        kind: 'transition-cut',
        choice: UI_LIKE.has(shot.treatment) ? 0 : 1,
        pan: side * CUT_PAN,
      };
    case 'crossfade':
      return {
        t: shot.t0,
        kind: 'transition-crossfade',
        durationS: Math.min(2, Math.max(0.7, transition.duration + 0.6)),
      };
    case 'glitch':
      return {
        t: shot.t0,
        kind: 'transition-glitch',
        durationS: Math.min(0.6, Math.max(0.25, transition.duration + 0.05)),
      };
    case 'wipe':
      return {
        t: shot.t0,
        kind: 'transition-wipe',
        durationS: Math.min(0.8, Math.max(0.4, transition.duration + 0.1)),
        pan: side * LIST_PAN,
      };
  }
}

/** Runs of pops no further apart than LIST_MAX_GAP_S. */
function popRuns(pops: readonly SceneSfxEvent[]): SceneSfxEvent[][] {
  const runs: SceneSfxEvent[][] = [];
  for (const pop of pops) {
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (run !== undefined && last !== undefined && pop.t - last.t <= LIST_MAX_GAP_S) run.push(pop);
    else runs.push([pop]);
  }
  return runs;
}

/** Pitch step (0 = lowest) of list item `index` of `count`: always from lowest to highest. */
export function listStep(index: number, count: number): number {
  const top = LIST_PITCH_ORDER.length - 1;
  if (count <= 1) return 0;
  return count <= LIST_PITCH_ORDER.length
    ? Math.round((index * top) / (count - 1))
    : Math.min(top, Math.floor((index * LIST_PITCH_ORDER.length) / count));
}

function popGestureCues(run: readonly SceneSfxEvent[]): EventCue[] {
  const [first] = run;
  if (run.length === 1 && first !== undefined) {
    const choice = POP_NAMES.indexOf(first.name as (typeof POP_NAMES)[number]);
    return [{ t: first.t, kind: 'appear', choice: Math.max(0, choice) }];
  }
  const count = run.length;
  return run.map((item, index) => ({
    t: item.t,
    kind: 'list-item',
    variant: LIST_PITCH_ORDER[listStep(index, count)],
    pan: count > 1 ? (index / (count - 1)) * 2 * LIST_PAN - LIST_PAN : 0,
  }));
}

/** Ticks from the counter's start to its landing, then the landing sound. */
function counterCues(
  shot: StoryboardShot,
  scene: readonly SceneSfxEvent[],
  words: readonly DirectorWord[],
): { cues: EventCue[]; used: Set<SceneSfxEvent> } {
  const used = new Set<SceneSfxEvent>();
  const numbers = words.filter((word) => inShot(shot, word.t) && isNumberWord(word.text));
  const firstStep = scene.find((event) => COUNTER_STEP_NAMES.has(event.name));
  const start = firstStep?.t ?? numbers[0]?.t ?? shot.t0 + 0.5;
  const final = scene.find(
    (event) => event.t > start && !COUNTER_STEP_NAMES.has(event.name) && isRecipe(event.name),
  );
  const lastNumber = numbers.filter((word) => word.t > start + RISER_MIN_S).at(-1);
  const end = Math.min(final?.t ?? lastNumber?.t ?? start + COUNTER_DEFAULT_S, shot.t1 - 0.2);
  for (const event of scene) if (COUNTER_STEP_NAMES.has(event.name)) used.add(event);
  if (final !== undefined) used.add(final);
  const span = end - start;
  const interval = Math.min(0.3, Math.max(0.12, span / 10));
  const steps = span > 0.3 ? Math.min(COUNTER_MAX_STEPS, Math.floor((span - 0.1) / interval)) : 0;
  const cues: EventCue[] = Array.from({ length: steps }, (_, index) => ({
    t: start + index * interval,
    kind: 'counter-step' as const,
    choice: index % 2,
    trimDb: steps > 1 ? -4 + (4 * index) / (steps - 1) : 0,
  }));
  const finalChoice = COUNTER_FINAL_CHOICE[final?.name ?? 'ding'];
  if (final !== undefined && finalChoice === undefined && isRecipe(final.name)) {
    cues.push({ t: end, kind: 'scene', recipe: final.name });
  } else {
    cues.push({ t: end, kind: 'counter-final', choice: finalChoice ?? 0 });
  }
  return { cues, used };
}

interface SceneGesture {
  readonly cues: EventCue[];
  /** The scene used this recipe earlier in the shot (lower priority). */
  readonly repeat: boolean;
}

function sceneGestureCues(scene: readonly SceneSfxEvent[]): SceneGesture[] {
  const pops = scene.filter((event) => (POP_NAMES as readonly string[]).includes(event.name));
  const gestures = popRuns(pops).map((run) => ({ cues: popGestureCues(run), repeat: false }));
  const seen = new Set<string>();
  for (const event of scene) {
    if ((POP_NAMES as readonly string[]).includes(event.name) || !isRecipe(event.name)) continue;
    gestures.push({
      cues: [
        event.name === 'typewriter'
          ? { t: event.t, kind: 'text-typed' }
          : { t: event.t, kind: 'scene', recipe: event.name },
      ],
      repeat: seen.has(event.name),
    });
    seen.add(event.name);
  }
  return gestures;
}

/** The emphasised word of a shot: `word!`, `word:` (the payoff follows) or ALL CAPS. */
function emphasisCues(shot: StoryboardShot, words: readonly DirectorWord[]): EventCue[] {
  const shotWords = words.filter((word) => inShot(shot, word.t));
  for (const [index, word] of shotWords.entries()) {
    const next = shotWords[index + 1];
    let hitT: number | undefined;
    let riser = true;
    if (word.text.endsWith('!')) hitT = word.t;
    else if (word.text.endsWith(':') && next !== undefined && next.t - word.tEnd < 1.5) {
      hitT = next.t;
    } else if (/^\p{Lu}{3,}$/u.test(word.text.replace(/[^\p{L}\p{N}]/gu, ''))) {
      hitT = word.t;
      riser = false;
    }
    if (hitT === undefined) continue;
    const room = hitT - (shot.t0 + DENSITY.shotHeadS);
    const riserS = Math.min(RISER_MAX_S, room);
    const hit: EventCue = { t: hitT, kind: 'emphasis-hit' };
    if (!riser || riserS < RISER_MIN_S) return [hit];
    return [{ t: hitT - riserS, kind: 'emphasis-riser', durationS: riserS }, hit];
  }
  return [];
}

class ShotGestures {
  readonly gestures: Gesture[] = [];
  /** Event times already covered by a sound. */
  readonly covered: number[] = [];

  constructor(private readonly shot: StoryboardShot) {}

  add(cues: readonly EventCue[], kind?: CueEventKind, priority?: number): void {
    const [first] = cues;
    if (first === undefined) return;
    this.gestures.push({
      shotId: this.shot.id,
      index: this.gestures.length,
      kind: kind ?? first.kind,
      ...(priority === undefined ? {} : { priority }),
      cues,
    });
    for (const cue of cues) this.covered.push(cue.t);
  }
}

function shotGestures(input: DirectorInput, shot: StoryboardShot, shotIndex: number): Gesture[] {
  const isLast = shotIndex === input.shots.length - 1;
  const out = new ShotGestures(shot);
  if (shotIndex > 0) out.add([transitionGesture(shot, shotIndex)]);
  let scene = input.sceneSfx.filter((event) => belongs(shot, event)).sort((a, b) => a.t - b.t);
  const anchors = input.anchors.filter((anchor) => belongs(shot, anchor)).map((a) => a.t);
  const hadSceneSfx = scene.length > 0;
  if (shot.treatment === 'counter/odometer') {
    const counter = counterCues(shot, scene, input.words);
    out.add(counter.cues, 'counter-step');
    scene = scene.filter((event) => !counter.used.has(event));
  }
  for (const gesture of sceneGestureCues(scene)) {
    out.add(gesture.cues, undefined, gesture.repeat ? DENSITY.repeatPriority : undefined);
  }
  if (isLast && shot.treatment === 'title-card') {
    out.add([{ t: shot.t0 + END_CARD_DELAY_S, kind: 'end-card' }]);
  } else if (shot.treatment === 'title-card' || shot.treatment === 'kinetic-text') {
    if (!near(out.covered, shot.t0 + 0.5, 1)) {
      out.add([{ t: shot.t0 + DENSITY.shotHeadS, kind: 'text-in' }]);
    }
  }
  if (!hadSceneSfx && shot.treatment !== 'counter/odometer') {
    const number = input.words.find(
      (word) =>
        inShot(shot, word.t) && isNumberWord(word.text) && !near(out.covered, word.t, COVER_S),
    );
    if (number !== undefined) {
      const big = BIG_NUMBER_TREATMENTS.has(shot.treatment) && near(anchors, number.t, 0.25);
      out.add([{ t: number.t, kind: big ? 'number-big' : 'number' }]);
    } else {
      const anchor = anchors.find((t) => !near(out.covered, t, COVER_S));
      if (anchor !== undefined) out.add([{ t: anchor, kind: 'appear', choice: shotIndex % 3 }]);
    }
  }
  const emphasis = emphasisCues(shot, input.words);
  const hit = emphasis.at(-1);
  if (hit !== undefined && !near(out.covered, hit.t, COVER_S)) out.add(emphasis, 'emphasis-hit');
  return out.gestures;
}

/** Every candidate gesture of the film, shot by shot (deterministic order). */
export function findGestures(input: DirectorInput): Gesture[] {
  return input.shots.flatMap((shot, index) => shotGestures(input, shot, index));
}
