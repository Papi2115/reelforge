/**
 * The Grim Ink direction step's prompt (PLAN.md#14.16, `c-cam-direction`, Sonnet, JSON reply): the
 * playbook digest of docs/worlds/c-cam-DIRECTION.md (≤ 3 KB, topic-neutral: it teaches HOW) and the
 * prompt variables (the script, its timed sentences, the world's style digest, the kit's gag kinds,
 * the rule numbers). The stage (packages/stages/src/c-cam/direction*.ts) adds what comes from the
 * kit and the project.
 */
import type { WordsFile } from '@reelforge/shared';
import { DIRECTION_RULES } from '../validators/direction-rules.js';
import { sentencesOf } from '../validators/shot-range.js';

/** The playbook digest the prompt carries at most. */
export const DIRECTION_PLAYBOOK_BUDGET = 3000;

export const C_CAM_DIRECTION_PLAYBOOK = `- Running gag: a person's one tic is planted early while nothing depends on it, comes back under rising pressure, and pays off on a quiet or decisive narration beat late in the film where it reads as character (calm under pressure, pride before the fall), never as decoration. The best gags restate the film's claim visually (the one who ranks lower always bows lower and is clearly in charge).
- Prop gag: one object used again and again, each use raising the stakes, the last one turning it upside down (a grievance notebook that ends as a rain hat).
- Accident: a small physical mishap the narration never says but motivates; it is the physical proof of the line ("mostly for show": the scabbard clacks into a stranger's and both bow forever).
- Climax ECU: the decisive fact happens in a hand on a thing; hold the extreme close-up on that instrument or object (a glove on the control stick, a key in the lock, the word carved in stone).
- Cause -> effect: action, consequence, judgement as three framings (a finger pokes the wall, it dents, the other one shrugs).
- Reaction hold: the beat lands, the face holds still >= 0.4 s (deadpan); the laugh lives in the gap.
- Over-the-shoulder then reverse: first what is seen, then who sees it and what it costs them.
- Foreground silhouette: a chair back, a door jamb, a shoulder or accusing arms at the lens give depth and a peeping point of view; one per framing that needs it.
- Dutch tilt (2-7 degrees, alternating sign) only on tense beats; level framings everywhere else keep it meaningful.
- Slow push-in on a realisation; pull-back to reveal scale or loneliness; a smash cut from expectation to reality.
- Prop reveal for scale: a comparison the narration states becomes one image (the old machine, then the modern thing thudding in beside it).
- Time passing as a change on a person (a beard grows under the year slate); a crowd acting as one body for the punchline.
- Title frame = thumbnail: the main people lined up in character (sweating, chewing, smug), the title thudding in letter by letter, their place behind them.
- Numbers seen in the films: 2-5 framings per shot (mean 3.3), a framing 0.4-2.4 s, an ECU about 1.4 s; close-ups and ECUs about half of all framings; each main person's gag in 3-7 shots; payoffs at 81-96 % of the runtime; 1-4 accidents per film; every ECU has a reason (the noun the narration says on that beat, or the gag's object).`;

export interface DirectionPromptInput {
  readonly script: string;
  readonly words: WordsFile;
  /** The world's style rules (≤ 1.5 KB). */
  readonly style: string;
  /** The kit's gag kinds (`C_CAM_VOCABULARY.gags`). */
  readonly gagKinds: readonly string[];
  /** The project's genre preset (name and tone), when it has one. */
  readonly genre?: string | undefined;
}

/** Narration end (s): the end of the last timed word. */
export function narrationEnd(words: WordsFile): number {
  return words.words.at(-1)?.tEnd ?? 0;
}

/** One line per sentence: `t0–t1 s: "text"`. */
export function timedSentences(words: WordsFile): string {
  return sentencesOf(words.words)
    .map((sentence) => {
      const text = words.words
        .slice(sentence.first, sentence.last + 1)
        .map((word) => word.text)
        .join(' ');
      return `- ${sentence.t0.toFixed(2)}–${sentence.t1.toFixed(2)} s: "${text}"`;
    })
    .join('\n');
}

/** Seconds of narration per planned beat (the concept films: a shot every 4–7 s). */
export const DIRECTION_BEAT_S = '4–6';

export function cCamDirectionPromptVars(
  input: DirectionPromptInput,
): Record<string, string | number> {
  return {
    durationS: narrationEnd(input.words).toFixed(1),
    script: input.script.trim(),
    sentences: timedSentences(input.words),
    style: input.style,
    playbook: C_CAM_DIRECTION_PLAYBOOK,
    gagKinds: input.gagKinds.join(', '),
    beatS: DIRECTION_BEAT_S,
    minFramings: DIRECTION_RULES.minFramings,
    maxFramings: DIRECTION_RULES.maxFramings,
    minClosePercent: DIRECTION_RULES.minCloseShare * 100,
    titleMaxWords: DIRECTION_RULES.titleMaxWords,
    ...(input.genre === undefined ? {} : { genre: input.genre }),
  };
}
