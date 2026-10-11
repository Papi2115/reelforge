/**
 * Test support for the Grim Ink direction step (PLAN.md#14.16): a valid plan for a synthetic film
 * (the minimal plan of its words, as Claude would reply it) and a storyboard that executes a plan
 * (title frame first, every other shot with its beats, gags and alternating framings).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { C_CAM_VOCABULARY } from '@reelforge/kit';
import { fallbackDirection } from '@reelforge/prompts';
import { wordsFileSchema, type DirectionFile, type FramingStep } from '@reelforge/shared';
import type { FilmShot } from './film.js';

/** The plan Claude "replies" for the film in `dir` (its words and script). */
export function filmPlan(dir: string): DirectionFile {
  const words = wordsFileSchema.parse(
    JSON.parse(readFileSync(path.join(dir, 'timing', 'words.json'), 'utf8')),
  );
  const script = readFileSync(path.join(dir, 'script.txt'), 'utf8');
  const plan = fallbackDirection({ words, script, gagKinds: C_CAM_VOCABULARY.gags });
  if (plan === undefined) throw new Error('the test film is too short for a plan');
  const reply = { ...plan };
  delete reply.source;
  return reply;
}

const A: readonly FramingStep[] = [
  { framing: 'wide', subject: 'the place' },
  { framing: 'ecu', subject: 'the thing', why: 'information: the narration names it' },
  { framing: 'close', subject: 'the lead', why: 'emotion: the reaction' },
];
const B: readonly FramingStep[] = [
  { framing: 'medium', subject: 'the lead' },
  { framing: 'ecu', subject: 'the thing', why: 'consequence: it decides the beat' },
];

/** Direction refs of `shots` (with their final cut times) that execute `plan`. */
export function directedShots(
  shots: readonly { readonly t0: number; readonly t1: number }[],
  plan: DirectionFile,
): NonNullable<FilmShot['direction']>[] {
  return shots.map((shot, index) => {
    if (index === 0) {
      return {
        titleFrame: true,
        framings: [{ framing: 'wide', subject: 'the title over the cast' }],
      };
    }
    const beats = plan.beats.filter((beat) => beat.span.t0 < shot.t1 && shot.t0 < beat.span.t1);
    const gags = [...new Set(beats.flatMap((beat) => beat.gagRefs))];
    return {
      beats: beats.map((beat) => beat.id),
      gags,
      framings: [...(index % 2 === 0 ? A : B)],
    };
  });
}
