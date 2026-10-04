/**
 * Scenes-per-minute checks of a storyboard (ADR-027; only for projects with a `shotsPerMinute`
 * range, storyboards without one never reach them): the film's average in the range ±10 %
 * (`shots-per-minute`, error), every minute of the film in [min x 0.6, max x 1.4] (warning), and
 * cuts on sentence ends (`cut-mid-sentence`, error). A sentence ends on a word whose text ends
 * with `.`, `!`, `?` or `…` (the script's punctuation in words.json). A cut inside a sentence is
 * allowed only when the sentence is long (`longSentenceS`) and the cut is on a clause boundary
 * (`,` `;` `:` `–`) or the next shot continues the previous one (`continues: true`, same look).
 * Narration without any sentence punctuation is not checked for cuts.
 */
import {
  filmClock,
  formatShotRange,
  SHOT_RANGE_TOLERANCE,
  SHOT_RANGE_WINDOW,
  shotLook,
  type ShotsPerMinute,
  type StoryboardShot,
  type TimedWord,
  type WordsFile,
} from '@reelforge/shared';
import { issue, type ValidationIssue } from './issues.js';

const SENTENCE_END = /[.!?…]["'”’)\]]*$/u;
const CLAUSE_END = /[,;:–—]["'”’)\]]*$/u;
const WINDOW_S = 60;
const WINDOW_STEP_S = 30;

export interface Sentence {
  /** Index of the first and the last word. */
  readonly first: number;
  readonly last: number;
  /** First word start and last word end (s). */
  readonly t0: number;
  readonly t1: number;
}

/** True when the word closes a sentence (its text ends with . ! ? or …). */
export function endsSentence(word: Pick<TimedWord, 'text'>): boolean {
  return SENTENCE_END.test(word.text.trim());
}

function endsClause(word: Pick<TimedWord, 'text'>): boolean {
  return CLAUSE_END.test(word.text.trim());
}

/** The narration's sentences; the last word always closes one. */
export function sentencesOf(words: readonly TimedWord[]): Sentence[] {
  const sentences: Sentence[] = [];
  let first = 0;
  words.forEach((word, index) => {
    if (!endsSentence(word) && index < words.length - 1) return;
    const start = words[first];
    if (start !== undefined) sentences.push({ first, last: index, t0: start.t, t1: word.tEnd });
    first = index + 1;
  });
  return sentences;
}

const fmt = (seconds: number): string => seconds.toFixed(2);
const rate = (value: number): string => value.toFixed(1);

function quote(words: readonly TimedWord[], sentence: Sentence): string {
  const all = words.slice(sentence.first, sentence.last + 1).map((word) => word.text);
  const text =
    all.length <= 10 ? all.join(' ') : `${all.slice(0, 5).join(' ')} … ${all.slice(-3).join(' ')}`;
  return `"${text}"`;
}

export interface ShotRangeCheckOptions {
  readonly range: ShotsPerMinute;
  /** Sentences longer than this (s) may be cut inside (shotRangeRules). */
  readonly longSentenceS: number;
  /** Boundary vs. a word start, seconds (the storyboard rule's tolerance). */
  readonly boundaryToleranceS: number;
}

function midSentenceIssues(
  shots: readonly StoryboardShot[],
  words: readonly TimedWord[],
  options: ShotRangeCheckOptions,
): ValidationIssue[] {
  const sentences = sentencesOf(words);
  if (sentences.length < 2) return [];
  return shots.slice(0, -1).flatMap((shot, index): ValidationIssue[] => {
    const next = shots[index + 1];
    // The word the next shot starts on (beat sync may cut in the pause before it).
    const after = words.findIndex((word) => word.t >= shot.t1 - options.boundaryToleranceS);
    const before = words[after - 1];
    if (next === undefined || before === undefined || endsSentence(before)) return [];
    const sentence = sentences.find((entry) => after >= entry.first && after <= entry.last);
    if (sentence === undefined) return [];
    const length = sentence.t1 - sentence.t0;
    const long = length > options.longSentenceS;
    const continued = next.continues === true && shotLook(next) === shotLook(shot);
    if (long && (endsClause(before) || continued)) return [];
    const nextSentence = words[sentence.last + 1];
    const starts = [sentence.t0, ...(nextSentence === undefined ? [] : [nextSentence.t])].filter(
      (t) => t > 0,
    );
    const move = `, or move the cut to a sentence start (${starts.map((t) => `${fmt(t)} s`).join(' or ')})`;
    const allowed = long
      ? `; the sentence lasts ${length.toFixed(1)} s, so a cut inside it is allowed on a clause boundary (after , ; : –) or when ${next.id} keeps the look of ${shot.id} (${shotLook(shot)}), continues the same subject and sets "continues": true`
      : '';
    return [
      issue(
        'error',
        'cut-mid-sentence',
        `${shot.id} → ${next.id} cuts at ${fmt(shot.t1)} s inside the sentence ${quote(words, sentence)}: one sentence is one shot — merge them into one shot with progressive reveals (annotations, objects appearing on the words, a camera move)${move}${allowed}`,
        `shots[${String(index)}].t1`,
      ),
    ];
  });
}

function averageIssues(
  shots: readonly StoryboardShot[],
  durationS: number,
  range: ShotsPerMinute,
): ValidationIssue[] {
  const perMinute = (shots.length * 60) / durationS;
  const low = range.min * (1 - SHOT_RANGE_TOLERANCE);
  const high = range.max * (1 + SHOT_RANGE_TOLERANCE);
  if (perMinute >= low && perMinute <= high) return [];
  const wanted = `${String(Math.round((range.min * durationS) / 60))}–${String(Math.round((range.max * durationS) / 60))}`;
  const fix =
    perMinute > high
      ? 'merge neighbouring shots that tell one idea (the same subject, the same sentence) into one shot whose picture develops on the words'
      : 'split the longest shots where a new idea starts (on a sentence start)';
  return [
    issue(
      'error',
      'shots-per-minute',
      `${String(shots.length)} shots for ${filmClock(durationS)} = ${rate(perMinute)} per minute; this project wants ${formatShotRange(range)} per minute (${wanted} shots): ${fix}`,
      'shots',
    ),
  ];
}

/** Shots in [from, to): each shot counts with the share of it inside the window. */
function shotsIn(shots: readonly StoryboardShot[], from: number, to: number): number {
  return shots.reduce((sum, shot) => {
    const overlap = Math.min(shot.t1, to) - Math.max(shot.t0, from);
    return overlap > 0 ? sum + overlap / (shot.t1 - shot.t0) : sum;
  }, 0);
}

function windowStarts(durationS: number): number[] {
  const starts: number[] = [];
  for (let from = 0; from + WINDOW_S <= durationS + 1e-6; from += WINDOW_STEP_S) starts.push(from);
  const last = durationS - WINDOW_S;
  if (starts.length > 0 && last - (starts.at(-1) ?? 0) > 1) starts.push(last);
  return starts;
}

interface WindowRate {
  readonly from: number;
  readonly perMinute: number;
  readonly side: 'fast' | 'slow' | undefined;
}

function windowIssues(
  shots: readonly StoryboardShot[],
  durationS: number,
  range: ShotsPerMinute,
): ValidationIssue[] {
  const low = range.min * SHOT_RANGE_WINDOW.low;
  const high = range.max * SHOT_RANGE_WINDOW.high;
  const rates: WindowRate[] = windowStarts(durationS).map((from) => {
    const perMinute = shotsIn(shots, from, from + WINDOW_S);
    const side = perMinute > high ? 'fast' : perMinute < low ? 'slow' : undefined;
    return { from, perMinute, side };
  });
  const issues: ValidationIssue[] = [];
  let group: WindowRate[] = [];
  const flush = (): void => {
    const first = group[0];
    const lastWindow = group.at(-1);
    if (first?.side === undefined || lastWindow === undefined) return;
    const extreme = group.reduce((best, entry) =>
      first.side === 'fast'
        ? entry.perMinute > best.perMinute
          ? entry
          : best
        : entry.perMinute < best.perMinute
          ? entry
          : best,
    );
    const what =
      first.side === 'fast' ? 'cuts much faster than the range' : 'cuts much slower than the range';
    issues.push(
      issue(
        'warning',
        'shots-per-minute',
        `${filmClock(first.from)}–${filmClock(lastWindow.from + WINDOW_S)} ${what}: up to ${rate(extreme.perMinute)} shots per minute (any minute should have ${rate(low)}–${rate(high)})`,
        'shots',
      ),
    );
  };
  for (const entry of rates) {
    if (entry.side !== group[0]?.side) {
      flush();
      group = [];
    }
    group.push(entry);
  }
  flush();
  return issues;
}

/** The range checks: the film's average, each minute, and with words the sentence-boundary rule. */
export function checkShotRange(
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
  options: ShotRangeCheckOptions,
): ValidationIssue[] {
  const durationS = shots.at(-1)?.t1 ?? 0;
  if (durationS <= 0) return [];
  return [
    ...averageIssues(shots, durationS, options.range),
    ...windowIssues(shots, durationS, options.range),
    ...(words === undefined ? [] : midSentenceIssues(shots, words.words, options)),
  ];
}
