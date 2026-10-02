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

export interface CriticCheckOptions {
  /** Image paths the critic was shown; each needs exactly one verdict. */
  readonly expectedPaths?: readonly string[];
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
  parsed.data.frames.forEach((frame, index) => {
    const words = frame.note.split(/\s+/).filter((word) => word !== '').length;
    if (words > CRITIC_NOTE_MAX_WORDS) {
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
