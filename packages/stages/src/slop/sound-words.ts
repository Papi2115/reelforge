/**
 * Sound-shaped words (docs/worlds/QUALITY.md §8, real runs Comic 2 / Game B1 2): onomatopoeia are
 * drawn, never narrated, so text provenance must not call them invented. A word is sound-shaped
 * by its spelling alone, in any world and any lettering: a letter held three times ("BRRRING",
 * "FSSSHH", "ZZZ", "BEEEP"; no English word has one), a doubled consonant opening it ("RRIP",
 * "ZZAP"; "ll" of "llama" is a real opening) or a vowel-less hush, hum or growl ("SHH", "HMM",
 * "PSST"). Real words that are sounds ("CRASH", "RING") stay the world's `soundWords`, allowed
 * only in its sound lettering.
 */

/** A letter three or more times in a row. */
const HELD_LETTER = /(\p{L})\1{2,}/u;
/** A doubled consonant opening the word (not `l`). */
const DOUBLED_OPENING = /^([b-df-hj-km-np-tv-z])\1/u;
/** Vowel-less sounds (lower case, letters as written). */
const VOWELLESS_SOUNDS: ReadonlySet<string> = new Set(
  'sh shh hm hmm mm psst pst pff pfft brr grr tsk zz krr prr'.split(' '),
);

/** Whether a lower-case word is spelled like a sound, whatever the world knows. */
export function isSoundShaped(word: string): boolean {
  return HELD_LETTER.test(word) || DOUBLED_OPENING.test(word) || VOWELLESS_SOUNDS.has(word);
}

/** A sound word of a list, letters held or not ("BEEEP" = beep, "KRAAAK" = krak). */
export function inSoundList(word: string, sounds: ReadonlySet<string> | undefined): boolean {
  if (sounds === undefined) return false;
  return [word, word.replace(/(.)\1{2,}/g, '$1$1'), word.replace(/(.)\1+/g, '$1')].some((form) =>
    sounds.has(form),
  );
}
