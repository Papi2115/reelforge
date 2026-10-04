/**
 * Test support for beat sync and repetition control (PLAN.md#12.21, #12.23): a deterministic
 * synthetic narration of any length with a natural rhythm (word lengths 0.18–0.45 s, short gaps
 * inside a phrase, comma and sentence pauses, some numbers and exclamations) and a storyboard
 * cut on word starts — mostly where a sentence begins, about one cut in five in the middle of a
 * sentence — with shots of 3–8 s, as the storyboard prompt asks.
 */
import { mulberry32 } from '@reelforge/pipeline';
import type { StoryboardShot, Treatment, WordsFile } from '@reelforge/shared';

const VOCABULARY = (
  'the engine was small but every frame had to fit inside tiny memory so hackers rewrote ' +
  'maps sprites sound and logic until the calculator could run it at a steady pace while ' +
  'teachers never noticed anything strange during the exam'
).split(' ');
const NUMBERS = ['61', 'four', 'twenty', '1993', 'ninety', 'three'];
const TREATMENTS: readonly Treatment[] = [
  'metaphor-object',
  'kinetic-text',
  '3d-reconstruction',
  'ui-mockup',
  'character-scene',
  'data-chart-3d',
];

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export interface SyntheticFilm {
  readonly words: WordsFile['words'];
  readonly shots: StoryboardShot[];
  readonly durationS: number;
}

function narration(durationS: number, seed: number): WordsFile['words'] {
  const rng = mulberry32(seed);
  const between = (low: number, high: number): number => low + rng() * (high - low);
  const words: { text: string; t: number; tEnd: number }[] = [];
  let t = 0.4;
  while (t < durationS - 2) {
    const length = 6 + Math.floor(rng() * 9);
    for (let index = 0; index < length && t < durationS - 1; index++) {
      const last = index === length - 1;
      let text =
        rng() < 0.06
          ? (NUMBERS[Math.floor(rng() * NUMBERS.length)] ?? '61')
          : (VOCABULARY[Math.floor(rng() * VOCABULARY.length)] ?? 'the');
      const comma = !last && index > 2 && rng() < 0.12;
      if (last) text += rng() < 0.1 ? '!' : '.';
      else if (comma) text += ',';
      const duration = between(0.18, 0.45);
      words.push({ text, t: round3(t), tEnd: round3(t + duration) });
      t +=
        duration + (last ? between(0.3, 0.7) : comma ? between(0.15, 0.25) : between(0.02, 0.08));
    }
  }
  return words;
}

export interface SyntheticFilmOptions {
  readonly seed?: number;
  /**
   * Cut this long before the word start where the pause allows it (inside the storyboard's 50 ms
   * tolerance, but off the accent): what beat sync has to fix. Default 0.
   */
  readonly cutLeadS?: number;
}

/** A film of about `durationS` seconds; same options, same film. */
export function syntheticFilm(
  durationS: number,
  options: SyntheticFilmOptions = {},
): SyntheticFilm {
  const seed = options.seed ?? 2121;
  const lead = options.cutLeadS ?? 0;
  const words = narration(durationS, seed);
  const rng = mulberry32(seed ^ 0x5eed);
  const sentenceStarts = words.flatMap((word, index) =>
    index > 0 && /[.!]$/.test(words[index - 1]?.text ?? '') ? [word.t] : [],
  );
  const lastEnd = words.at(-1)?.tEnd ?? durationS;
  const cuts: number[] = [];
  let previous = 0;
  for (;;) {
    const target = previous + 3 + rng() * 4;
    const midSentence = rng() < 0.2;
    const inRange = (t: number): boolean => t - previous >= 3 && t - previous <= 8;
    const all = words.map((word) => word.t).filter(inRange);
    const pool = midSentence ? all : sentenceStarts.filter(inRange);
    const choices = pool.length > 0 ? pool : all;
    const next = choices.find((t) => t >= target) ?? choices.at(-1);
    if (next === undefined || lastEnd - next < 3) break;
    cuts.push(next);
    previous = next;
  }
  const leadIn = (cut: number): number => {
    const index = words.findIndex((word) => word.t === cut);
    const gap = cut - (words[index - 1]?.tEnd ?? 0);
    return gap > lead + 0.01 ? round3(cut - lead) : cut;
  };
  const edges = [0, ...cuts.map(leadIn), round3(lastEnd + 0.3)];
  const shots = edges.slice(0, -1).map((t0, index): StoryboardShot => {
    const id = `s${String(index + 1).padStart(3, '0')}`;
    const t1 = edges[index + 1] ?? t0 + 1;
    return {
      id,
      t0,
      t1,
      treatment: TREATMENTS[index % TREATMENTS.length] ?? 'metaphor-object',
      intent: `Shot ${id}`,
      scene: `scenes/${id}.js`,
      ...(index > 0 && index % 7 === 0
        ? { transitionIn: { type: 'crossfade' as const, duration: 0.4 } }
        : {}),
    };
  });
  return { words, shots, durationS: shots.at(-1)?.t1 ?? lastEnd };
}
