/** Frame critic reply (Haiku QA, PLAN.md §4.4): `{"frames":[{"path","verdict","note"}]}`. */
import { z } from 'zod';
import {
  issue,
  parseJsonText,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

export const CRITIC_VERDICTS = ['blank', 'clipped', 'overlap', 'off-intent', 'ok'] as const;
export type CriticVerdict = (typeof CRITIC_VERDICTS)[number];

export const criticReplySchema = z.strictObject({
  frames: z
    .array(
      z.strictObject({
        path: z.string().min(1),
        verdict: z.enum(CRITIC_VERDICTS),
        note: z.string(),
      }),
    )
    .min(1),
});
export type CriticReply = z.infer<typeof criticReplySchema>;

/** The prompt asks for notes of at most this many words. */
export const CRITIC_NOTE_MAX_WORDS = 15;
/** ...or this many in a world, where an `ok` note names the focal point and the traces. */
export const CRITIC_CRAFT_NOTE_MAX_WORDS = 25;
/** Human traces a world frame needs (QUALITY.md §2). */
export const MIN_CRAFT_TRACES = 3;

export interface CriticCheckOptions {
  /** Image paths the critic was shown; each needs exactly one verdict. */
  readonly expectedPaths?: readonly string[];
  /**
   * A world's craft check (PLAN.md#13.6): an `ok` note must name the focal point and at least
   * three human traces (`craft-note` warning otherwise; the scene stage fails such a frame).
   */
  readonly craft?: boolean;
}

/** What a world critic found in an `ok` frame: `focal: <thing>; traces: <a>, <b>, <c>`. */
export interface CraftNote {
  readonly focal: string;
  readonly traces: readonly string[];
}

/** `focal: …` and `traces: …` may be separated by `;`, `|`, `.`, `,` or a line break. */
const CRAFT_NOTE = /focal\s*:\s*(.+?)(?:\s*[;|.,]\s*|[^\S\n]*\n\s*)traces?\s*:\s*([\s\S]+)$/i;

/** The focal point and traces of a craft note; undefined when the note names no focal point. */
export function parseCraftNote(note: string): CraftNote | undefined {
  const match = CRAFT_NOTE.exec(note.trim());
  if (match === null) return undefined;
  const [, focal = '', list = ''] = match;
  const traces = list
    .split(/,|;|\band\b/)
    .map((trace) => trace.trim().replace(/\.$/, ''))
    .filter((trace) => trace !== '');
  return { focal, traces };
}

/** True when a note names a focal point and at least `MIN_CRAFT_TRACES` traces. */
export function isCraftNote(note: string): boolean {
  return (parseCraftNote(note)?.traces.length ?? 0) >= MIN_CRAFT_TRACES;
}

const normalize = (value: string): string => value.replaceAll('\\', '/').toLowerCase();

function pathIssues(reply: CriticReply, expected: readonly string[]): ValidationIssue[] {
  const judged = reply.frames.map((frame) => normalize(frame.path));
  const wanted = new Set(expected.map(normalize));
  const issues = expected
    .filter((path) => !judged.includes(normalize(path)))
    .map((path) => issue('error', 'missing-frame', `no verdict for ${path}`));
  reply.frames.forEach((frame, index) => {
    if (!wanted.has(normalize(frame.path))) {
      issues.push(
        issue(
          'warning',
          'unexpected-frame',
          `verdict for an unknown image ${frame.path}`,
          `frames[${String(index)}].path`,
        ),
      );
    }
  });
  return issues;
}

export function validateCriticReply(
  text: string,
  options: CriticCheckOptions = {},
): ValidationReport<CriticReply> {
  const json = parseJsonText(text);
  if (!json.parsed) return report<CriticReply>(undefined, json.issues);
  const parsed = criticReplySchema.safeParse(json.value);
  if (!parsed.success)
    return report<CriticReply>(undefined, [...json.issues, ...schemaIssues(parsed.error)]);
  const issues = [...json.issues];
  const maxWords = options.craft === true ? CRITIC_CRAFT_NOTE_MAX_WORDS : CRITIC_NOTE_MAX_WORDS;
  parsed.data.frames.forEach((frame, index) => {
    if (options.craft === true && frame.verdict === 'ok' && !isCraftNote(frame.note)) {
      issues.push(
        issue(
          'warning',
          'craft-note',
          `an ok frame must name its focal point and ${String(MIN_CRAFT_TRACES)} human traces ("focal: …; traces: …")`,
          `frames[${String(index)}].note`,
        ),
      );
    }
    const words = frame.note.split(/\s+/).filter((word) => word !== '').length;
    if (words > maxWords) {
      issues.push(
        issue(
          'warning',
          'long-note',
          `note has ${String(words)} words`,
          `frames[${String(index)}].note`,
        ),
      );
    }
  });
  if (options.expectedPaths !== undefined)
    issues.push(...pathIssues(parsed.data, options.expectedPaths));
  return report(parsed.data, issues);
}
