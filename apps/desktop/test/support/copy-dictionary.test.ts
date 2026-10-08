/**
 * The dictionary of the UI copy (docs/ui-copy.md "Dictionary", docs/ux/redesign-2.4.md U12): no
 * string the renderer shows names a file, a runner key or an internal concept. The scanner
 * (copy-scan.ts) reads JSX text, text attributes and prose-like literals; technical places (the
 * About and Report a problem dialogs, logs) are allowed by file and phrase in ALLOWED.
 */
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  collectCopy,
  collectCopyOf,
  looksLikeProse,
  sourceFiles,
  type CopyString,
} from './copy-scan.js';

interface ForbiddenWord {
  readonly pattern: RegExp;
  /** What to say instead (shown when the test fails). */
  readonly instead: string;
  /** Also in short literals that may be shown (distinctive phrases only, never single words). */
  readonly anywhere?: true;
}

/** Words the UI never says (docs/ui-copy.md "Dictionary"). */
export const FORBIDDEN: readonly ForbiddenWord[] = [
  { pattern: /\b[\w.-]+\.(?:json|wav|txt|js)\b/, instead: 'what it is, not its file name' },
  { pattern: /\bpipelines?\b/i, instead: '"the steps"' },
  { pattern: /\bstages?\b/i, instead: '"step"' },
  { pattern: /\bartifacts?\b/i, instead: '"result"' },
  { pattern: /\bseeds?\b/i, instead: 'nothing: it is internal' },
  { pattern: /\bLUTs?\b/, instead: '"colour grade"' },
  { pattern: /\bIPC\b/, instead: 'nothing: it is internal' },
  { pattern: /\bids\b/i, instead: '"names" (shot names read s01, s02 …)' },
  {
    pattern: /\b(?:sound-cues|scenes-built|words-timed|audio-cleaned)\b/,
    instead: 'the step name',
  },
  { pattern: /\bFailed\s+—\s+see details\b/i, instead: 'what still works, then what failed' },
  { pattern: /\binterrupts?\b/i, instead: '"surprise moments"', anywhere: true },
  { pattern: /\bopen[- ](?:and close )?loops?\b/i, instead: '"questions"', anywhere: true },
  { pattern: /\breveal[- ]moments?\b/i, instead: '"wow moments"', anywhere: true },
];

/**
 * Technical places and names that stay: `file` + the whole string (`text`) or a part of it
 * (`phrase`). Keep it short; every entry says why.
 */
const ALLOWED: readonly {
  readonly file: string;
  readonly text?: string;
  readonly phrase?: string;
  readonly why: string;
}[] = [
  {
    file: 'renderer/onboarding/HelpDialogs.tsx',
    phrase: 'main.log',
    why: 'Report a problem names the log file to share',
  },
  {
    file: 'renderer/layout/PipelineSidebar.tsx',
    text: 'Pipeline',
    why: 'the panel name (Premiere-style layout; the app tests find the region by it)',
  },
  { file: 'renderer/onboarding/tour.ts', text: 'The pipeline', why: 'the tour card of that panel' },
];

function allowed(file: string, text: string): boolean {
  return ALLOWED.some(
    (entry) =>
      entry.file === file &&
      (entry.text === text || (entry.phrase !== undefined && text.includes(entry.phrase))),
  );
}

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));
/** Never shown: the hidden render window and the log helper. */
const SKIP = ['renderer/render-host', 'renderer/log.ts'];
/** Main's files whose messages the renderer shows as they are. */
const MAIN_MESSAGES = ['main/dramaturgy-service.ts'];

function violations(copy: readonly CopyString[]): string[] {
  return copy.flatMap(({ file, line, text, shown }) =>
    FORBIDDEN.filter(({ pattern, anywhere }) => (shown || anywhere === true) && pattern.test(text))
      .filter(() => !allowed(file, text))
      .map(
        ({ pattern, instead }) =>
          `${file}:${String(line)} "${text}" (${String(pattern)}: say ${instead})`,
      ),
  );
}

describe('copy scanner', () => {
  it('reads JSX text, text attributes and child literals, skips code', () => {
    const copy = collectCopy(
      'x.tsx',
      [
        "import { a } from './stage.js';",
        "log.info('stage started');",
        "if (kind === 'stage') throw new Error('Pipeline broke.');",
        "const label = 'Words timed again.';",
        'const node = (',
        '  <div className="stage" title="Open the stage" data-x="stage">',
        '    Run the pipeline',
        "    {busy ? 'Working…' : 'Run the stage'}",
        '  </div>',
        ');',
      ].join('\n'),
    );
    expect(copy.filter((entry) => entry.shown).map((entry) => entry.text)).toEqual([
      'Words timed again.',
      'Open the stage',
      'Run the pipeline',
      'Working…',
      'Run the stage',
    ]);
  });

  it('joins a template literal and tells prose from keys', () => {
    const copy = collectCopy(
      'x.ts',
      'const a = `Built ${n} of ${m} scenes.`; const b = `s-${id}`;',
    );
    expect(copy.map((entry) => [entry.text, entry.shown])).toEqual([
      ['Built {} of {} scenes.', true],
      ['s-{}', false],
    ]);
    expect(looksLikeProse('sound-cues')).toBe(false);
    expect(looksLikeProse('small-button primary')).toBe(false);
    expect(looksLikeProse('Export video')).toBe(true);
    expect(looksLikeProse('then write the script.')).toBe(true);
  });

  it('flags forbidden words and honours the allowlist', () => {
    const copy: CopyString[] = [
      { file: 'a.tsx', line: 1, text: 'Saved to words.json', shown: true },
      { file: 'a.tsx', line: 2, text: 'no pattern interrupts', shown: false },
      { file: 'renderer/onboarding/HelpDialogs.tsx', line: 3, text: 'take main.log', shown: true },
      { file: 'a.tsx', line: 4, text: 'Surprise moments', shown: true },
      { file: 'a.tsx', line: 5, text: 'stage', shown: false },
    ];
    expect(violations(copy).map((line) => line.split(' ')[0])).toEqual(['a.tsx:1', 'a.tsx:2']);
  });
});

describe('renderer copy', () => {
  it('uses no forbidden word (docs/ui-copy.md "Dictionary")', () => {
    const files = sourceFiles(SRC, SKIP).filter((file) => file.startsWith('renderer/'));
    const copy = collectCopyOf(SRC, [...files, ...MAIN_MESSAGES]);
    // The scanner still sees the app: a broken scanner must not pass silently.
    expect(copy.length).toBeGreaterThan(1000);
    expect(violations(copy)).toEqual([]);
  });
});
