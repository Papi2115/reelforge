/**
 * The minimal direction plan of a Grim Ink film when Claude fails (PLAN.md#14.16): deterministic,
 * from the timed words alone, and valid by the direction rules so the storyboard and the scenes
 * still have a plan to follow (the stage marks it ⚠). Beats are the narration's sentences (a
 * sentence over 8 s is split at its middle word); one person (`lead`) with one signature gag set up
 * on the first beat, escalated in the middle and paid off on the last beat (in the last 30 %); an
 * accident at about a third; the climax ECU near 80 %; framing progressions cycling through four
 * distinct sequences; the title frame from the script's first words.
 */
import type {
  BeatIntent,
  DirectionBeat,
  DirectionFile,
  FramingStep,
  TimedWord,
  WordsFile,
} from '@reelforge/shared';
import { DIRECTION_RULES } from '../validators/direction-rules.js';
import { sentencesOf } from '../validators/shot-range.js';

/** A fallback beat longer than this (s) is split at its middle word. */
const MAX_BEAT_S = 8;
const MIN_BEATS = 3;
const LEAD = 'lead';
const PLACE = 'mainPlace';
const PREFERRED_GAG = 'fidget';

interface Segment {
  readonly first: number;
  readonly last: number;
}

function span(words: readonly TimedWord[], segment: Segment): { t0: number; t1: number } {
  return { t0: words[segment.first]?.t ?? 0, t1: words[segment.last]?.tEnd ?? 0 };
}

/** Splits the segment at the word starting nearest `at` (both halves keep a word), or undefined. */
function splitAt(words: readonly TimedWord[], segment: Segment, at: number): Segment[] | undefined {
  let best: number | undefined;
  for (let index = segment.first + 1; index <= segment.last; index += 1) {
    const start = words[index]?.t ?? 0;
    const current = best === undefined ? Infinity : Math.abs((words[best]?.t ?? 0) - at);
    if (Math.abs(start - at) < current) best = index;
  }
  if (best === undefined) return undefined;
  return [
    { first: segment.first, last: best - 1 },
    { first: best, last: segment.last },
  ];
}

function middleOf(words: readonly TimedWord[], segment: Segment): number {
  const { t0, t1 } = span(words, segment);
  return (t0 + t1) / 2;
}

function segments(words: readonly TimedWord[], durationS: number): Segment[] {
  let list: Segment[] = sentencesOf(words).map(({ first, last }) => ({ first, last }));
  const length = (segment: Segment): number => {
    const { t0, t1 } = span(words, segment);
    return t1 - t0;
  };
  for (let guard = 0; guard < 400; guard += 1) {
    const index = list.findIndex((segment) => length(segment) > MAX_BEAT_S);
    const longest = list.reduce(
      (best, segment, at) => (length(segment) > length(list[best] ?? segment) ? at : best),
      0,
    );
    const target = index >= 0 ? index : list.length < MIN_BEATS ? longest : -1;
    const segment = list[target];
    if (segment === undefined) break;
    const halves = splitAt(words, segment, middleOf(words, segment));
    if (halves === undefined) break;
    list = [...list.slice(0, target), ...halves, ...list.slice(target + 1)];
  }
  // The payoff (the last beat) sits in the last 30 %: split the last beat there when it starts earlier.
  const last = list.at(-1);
  const payoffAt = DIRECTION_RULES.payoffFrom * durationS;
  if (last !== undefined && middleOf(words, last) < payoffAt) {
    const first = words.findIndex((word, index) => index > last.first && word.t >= payoffAt);
    if (first > last.first && first <= last.last) {
      list = [
        ...list.slice(0, -1),
        { first: last.first, last: first - 1 },
        { first, last: last.last },
      ];
    }
  }
  return list;
}

function quote(text: string, count: number): string {
  const words = text.split(/\s+/).filter((word) => word !== '');
  return words.length <= count ? text : `${words.slice(0, count).join(' ')}…`;
}

const step = (framing: FramingStep['framing'], subject: string, why?: string): FramingStep =>
  why === undefined ? { framing, subject } : { framing, subject, why };

function progression(index: number, text: string): FramingStep[] {
  const thing = `the thing named in "${quote(text, 5)}"`;
  const info = 'information: what the narration names on this beat';
  const emotion = 'emotion: the lead takes the beat in';
  const cycle: FramingStep[][] = [
    [
      step('wide', 'the place and the lead'),
      step('ecu', thing, info),
      step('close', 'the lead', emotion),
    ],
    [step('medium', 'the lead in the place'), step('close', 'the lead', emotion)],
    [
      step('ots', "over the lead's shoulder"),
      step('ecu', thing, info),
      step('wide', 'pull back on the place'),
    ],
    [
      step('wide', 'the place'),
      step('close', 'the lead', emotion),
      step('medium', 'the lead and the thing'),
    ],
  ];
  return cycle[index % cycle.length] ?? [];
}

function climaxProgression(text: string): FramingStep[] {
  const thing = `the thing that decides "${quote(text, 5)}"`;
  return [
    step('medium', 'the lead at the decisive moment'),
    step('ecu', thing, 'consequence: the outcome happens in this thing'),
    step('close', 'the lead', 'emotion: the lead holds still as it lands'),
  ];
}

const OTHER_INTENTS: readonly BeatIntent[] = ['reveal', 'reaction', 'breath'];

function closestTo(beats: readonly DirectionBeat[], at: number): number {
  let best = 0;
  beats.forEach((beat, index) => {
    const mid = (beat.span.t0 + beat.span.t1) / 2;
    const current = beats[best];
    if (current === undefined) return;
    if (Math.abs(mid - at) < Math.abs((current.span.t0 + current.span.t1) / 2 - at)) best = index;
  });
  return best;
}

/** The title: the first words (at most 6) of the script's first sentence. */
export function fallbackTitle(script: string): string {
  const sentence = script.trim().split(/(?<=[.!?…])\s/)[0] ?? '';
  const words = sentence
    .replace(/[.!?…:;,"“”]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, DIRECTION_RULES.titleMaxWords);
  return words.length === 0 ? 'Untitled' : words.join(' ');
}

export interface FallbackDirectionInput {
  readonly words: WordsFile;
  readonly script: string;
  readonly gagKinds: readonly string[];
}

/** The minimal plan, or undefined when the narration has fewer than three words. */
export function fallbackDirection(input: FallbackDirectionInput): DirectionFile | undefined {
  const words = input.words.words;
  if (words.length < MIN_BEATS) return undefined;
  const durationS = words.at(-1)?.tEnd ?? 0;
  const parts = segments(words, durationS);
  if (parts.length < MIN_BEATS) return undefined;
  const beats: DirectionBeat[] = parts.map((segment, index) => {
    const text = words
      .slice(segment.first, segment.last + 1)
      .map((word) => word.text)
      .join(' ');
    const { t0, t1 } = span(words, segment);
    return {
      id: `b${String(index + 1).padStart(2, '0')}`,
      span: { t0, t1, text },
      intent: index === 0 ? 'setup' : (OTHER_INTENTS[index % OTHER_INTENTS.length] ?? 'reveal'),
      camera: { progression: progression(index, text) },
      gagRefs: [],
    };
  });
  const last = beats.length - 1;
  const middle = Math.round(last / 2);
  const climax = closestTo(beats, 0.8 * durationS);
  const accident = Math.max(1, Math.min(last - 1, Math.round(last * 0.35)));
  const set = (index: number, patch: Partial<DirectionBeat>): void => {
    const beat = beats[index];
    if (beat !== undefined) beats[index] = { ...beat, ...patch };
  };
  for (const index of new Set([0, middle, last])) set(index, { gagRefs: [LEAD] });
  const climaxBeat = beats[climax];
  if (climaxBeat !== undefined) {
    set(climax, {
      intent: 'tension',
      camera: { progression: climaxProgression(climaxBeat.span.text), tilt: true },
    });
  }
  set(last, { intent: 'punchline' });
  set(accident, {
    intent: 'cause-effect',
    accident:
      'the lead fumbles and drops something small, then freezes (a small mishap the narration does not say)',
  });
  const ids = beats.map((beat) => beat.id);
  const kind = input.gagKinds.includes(PREFERRED_GAG)
    ? PREFERRED_GAG
    : (input.gagKinds[0] ?? PREFERRED_GAG);
  return {
    version: 1,
    source: 'fallback',
    titleFrame: {
      cast: [LEAD],
      title: fallbackTitle(input.script),
      background: { placeId: PLACE, why: 'the setting the narration opens in' },
      acting: [
        { person: LEAD, pose: 'stand', expr: 'scared', note: 'braced for what the title promises' },
      ],
      accentObject: 'the one object the opening line names',
    },
    motifs: [],
    cast: [
      {
        id: LEAD,
        role: 'the person the narration follows (its "you")',
        signatureGag: {
          kind,
          note: 'a nervous tic that grows with the pressure',
          arc: {
            setup: ids[0] ?? 'b01',
            escalations: [ids[middle] ?? 'b02'],
            payoff: ids[last] ?? 'b03',
            why: 'the nerves are how the viewer feels the stakes',
          },
        },
      },
    ],
    beats,
    climax: {
      beatRef: ids[climax] ?? 'b01',
      ecuSubject: `the thing that decides "${quote(climaxBeat?.span.text ?? '', 5)}"`,
      why: "consequence: the narration's decisive moment happens in this thing",
    },
    accidents: [ids[accident] ?? 'b02'],
  };
}
