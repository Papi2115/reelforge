/**
 * Chapter titles from the narration (real run 2.3: titles taken from shot intents read like
 * "Cold open in a dark"): the key phrase of the sentence spoken at the chapter start, i.e. its
 * longest run of content words (filler and function words break runs, "of"/"and" may join two
 * content words), at most MAX_TITLE_WORDS words, in title case. EN and PL function words.
 */
import type { TimedWord } from '@reelforge/shared';

/** Words spoken up to this long before the chapter start still belong to it (shot cut lead). */
const LEAD_S = 0.3;
/** At most this many words of the first sentence are read. */
const SENTENCE_WORDS = 16;

const STOP_WORDS = new Set(
  [
    // English function words and filler
    'a an the of on in to and or but so if as at by for from with into onto over under about',
    "than then that this these those there here it its it’s it's is are was were be been being",
    'am do does did done have has had having can could will would shall should may might must',
    'not no nor only just very really actually basically literally like well okay ok now',
    'i me my we us our you your he him his she her they them their what which who whom whose',
    'when where why how all any both each few more most other some such own same too also',
    "again once up down out off one let’s let's here’s here's that’s that's there’s there's",
    'yes yeah right even still yet though because while until after before during every',
    'almost anything something everything nothing',
    // Polish function words and filler
    'i w we z ze na do to że się jest są był była było byli o od po za jak ale czy nie tak',
    'już tylko ten ta te tego tej co który która które bo więc no teraz a oraz lub dla przez',
    'pod nad przy jego jej ich nas was mu go ją tu tam też jeszcze bardzo właśnie by żeby gdy',
  ]
    .join(' ')
    .split(' '),
);
/** Joiners kept inside a run when a content word follows ("Rope of Memory"). */
const JOINERS = new Set(['of', 'and', '&']);
/** Lower-case in title case unless first. */
const MINOR_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for']);

/** The word without surrounding punctuation ("1969," → "1969", "“Houston”" → "Houston"). */
function bare(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function isContent(word: string): boolean {
  return word !== '' && !STOP_WORDS.has(word.toLowerCase());
}

function endsSentence(text: string): boolean {
  return /[.!?…]["'”’)\]]*$/.test(text);
}

/** The words of the first sentence spoken from `t` (before `until`). */
function sentenceAt(words: readonly TimedWord[], t: number, until: number): string[] {
  const first = words.findIndex((word) => word.t >= t - LEAD_S);
  if (first < 0) return [];
  const sentence: string[] = [];
  for (const word of words.slice(first)) {
    if (word.t >= until || sentence.length >= SENTENCE_WORDS) break;
    sentence.push(word.text);
    if (endsSentence(word.text)) break;
  }
  return sentence;
}

/** Longest run of content words (joiners inside); ties: the earliest. */
function keyPhrase(sentence: readonly string[]): string[] {
  let best: string[] = [];
  let run: string[] = [];
  const close = (): void => {
    while (run.length > 0 && !isContent(run.at(-1) ?? '')) run.pop();
    const count = run.filter(isContent).length;
    if (count > best.filter(isContent).length) best = run;
    run = [];
  };
  sentence.forEach((raw, index) => {
    const word = bare(raw);
    const next = bare(sentence[index + 1] ?? '');
    if (isContent(word)) run.push(word);
    else if (run.length > 0 && JOINERS.has(word.toLowerCase()) && isContent(next)) run.push(word);
    else close();
    // A clause ends the run (a comma between two names is not one phrase).
    if (/[,;:]$/.test(raw)) close();
  });
  close();
  return best;
}

function titleCase(words: readonly string[]): string {
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && MINOR_WORDS.has(lower)) return lower;
      // Keep acronyms and mixed case ("NASA", "iPhone", "4KB"); capitalise the rest.
      if (word !== lower) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Title from the narration spoken at `t` (before `until`, the next chapter): undefined when no
 * word is spoken there or the sentence has no content word.
 */
export function spokenChapterTitle(
  words: readonly TimedWord[],
  t: number,
  until: number,
  maxWords: number,
): string | undefined {
  const phrase = keyPhrase(sentenceAt(words, t, until)).slice(0, maxWords);
  while (phrase.length > 1 && !isContent(phrase.at(-1) ?? '')) phrase.pop();
  return phrase.length === 0 ? undefined : titleCase(phrase);
}
