/**
 * A world moment that needs a speaker (`WorldMomentOption.speaker`: Game B2 `dialogue`) only where
 * the narration lets someone speak (real run Game B2 2: a `dialogue` on "whether oaks share … is
 * debated" made the asset step invent a faceless "keeper" to say the line). The shot's words (and
 * the few seconds leading into it, where an attribution often sits) must quote someone or carry a
 * speech verb ("the ranger says", "she told", "according to"). Words.json has no speakers, so a
 * quote mark or one of these verbs is the evidence; without the words there is nothing to check.
 * Every finding is an error, so the storyboard's repair turn moves the line to the narration box.
 */
import type { StoryboardShot, WordsFile } from '@reelforge/shared';
import type { WorldMomentOption } from '../worlds/types.js';
import { issue, type ValidationIssue } from './issues.js';

/** Seconds before the shot whose words still count (the attribution of a quote). */
export const SPEAKER_LEAD_S = 3;

const SPEECH = new Set(
  (
    'say says said saying tell tells told ask asks asked answer answers answered reply replies ' +
    'replied explain explains explained warn warns warned admit admits admitted insist insists ' +
    'insisted recall recalls recalled claim claims claimed argue argues argued according quote ' +
    'quotes quoted wrote writes shout shouts shouted whisper whispers whispered announce ' +
    'announces announced'
  ).split(' '),
);
const QUOTE = /["“”«»]/;

/** True when the words in [t0, t1] quote someone or carry a speech verb. */
export function narrationHasSpeaker(words: WordsFile, t0: number, t1: number): boolean {
  return words.words.some((word) => {
    if (word.tEnd <= t0 || word.t >= t1) return false;
    if (QUOTE.test(word.text)) return true;
    const bare = word.text.toLowerCase().replace(/[^\p{L}']/gu, '');
    return SPEECH.has(bare);
  });
}

export function checkWorldSpeakers(
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
  moments: readonly WorldMomentOption[],
): ValidationIssue[] {
  if (words === undefined) return [];
  const needs = new Set(moments.filter((option) => option.speaker === true).map((o) => o.id));
  return shots.flatMap((shot, index): ValidationIssue[] => {
    const moment = shot.worldMoment;
    if (moment === undefined || !needs.has(moment)) return [];
    if (narrationHasSpeaker(words, shot.t0 - SPEAKER_LEAD_S, shot.t1)) return [];
    return [
      issue(
        'error',
        'moment-speaker',
        `${shot.id}: ${moment} needs someone the narration lets speak (a quote, or "the ranger says …" in these words), and nobody speaks here: the scene would have to invent a person. Give the line to the narration box (leave the moment out or plan another one), or move ${moment} to a shot where the narration quotes someone`,
        `shots[${String(index)}].worldMoment`,
      ),
    ];
  });
}
