/**
 * Structured commit messages: a subject line, an optional body and ReelForge trailers
 *
 *   Scenes built: s03 calculator desk
 *
 *   ReelForge-Step: scenes-built
 *   ReelForge-Kind: pipeline-step
 *
 * read back by `history()` with `git log --format=%(trailers:...)`.
 */
import { err, ok, projectError, type Result } from './result.js';

export const STEP_TRAILER = 'ReelForge-Step';
export const KIND_TRAILER = 'ReelForge-Kind';
export const REVERT_TRAILER = 'ReelForge-Revert-Of';

/** What made an autocommit: a finished pipeline step, a Claude turn, or the user. */
export const AUTOCOMMIT_KINDS = ['pipeline-step', 'claude-turn', 'manual'] as const;
export type AutocommitKind = (typeof AUTOCOMMIT_KINDS)[number];

/** Kinds written by this package; `external` = a commit made outside ReelForge (no trailer). */
export const COMMIT_KINDS = [...AUTOCOMMIT_KINDS, 'create', 'revert'] as const;
export type CommitKind = (typeof COMMIT_KINDS)[number];
export type HistoryKind = CommitKind | 'external';

/** Step ids: lowercase, `[a-z0-9._-]`, e.g. `script`, `scenes-built`, `claude-turn`. */
export const STEP_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const MAX_SUBJECT_LENGTH = 120;

export interface CommitMessageParts {
  /** First line = subject, further lines = body. */
  readonly message: string;
  readonly kind: CommitKind;
  readonly step: string;
  readonly revertOf?: string;
}

export function parseKind(value: string): CommitKind | undefined {
  return COMMIT_KINDS.find((kind) => kind === value);
}

/** Subject: first non-empty line, whitespace collapsed, at most 120 characters. */
function subjectAndBody(message: string): { subject: string; body: string } {
  const lines = message.replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.trim() !== '');
  if (first < 0) return { subject: '', body: '' };
  const collapsed = (lines[first] ?? '').trim().replace(/\s+/g, ' ');
  const subject =
    collapsed.length > MAX_SUBJECT_LENGTH
      ? `${collapsed.slice(0, MAX_SUBJECT_LENGTH - 1)}…`
      : collapsed;
  const body = lines
    .slice(first + 1)
    .join('\n')
    .trim();
  return { subject, body };
}

export function formatCommitMessage(parts: CommitMessageParts): Result<string> {
  const { subject, body } = subjectAndBody(parts.message);
  if (subject === '') {
    return err(projectError('invalid-argument', 'a commit message must not be empty'));
  }
  if (!STEP_ID_PATTERN.test(parts.step)) {
    return err(
      projectError(
        'invalid-argument',
        `step id "${parts.step}" must be lowercase letters, digits, ".", "_" or "-" (e.g. "scenes-built")`,
      ),
    );
  }
  const trailers = [`${STEP_TRAILER}: ${parts.step}`, `${KIND_TRAILER}: ${parts.kind}`];
  if (parts.revertOf !== undefined) trailers.push(`${REVERT_TRAILER}: ${parts.revertOf}`);
  const paragraphs = body === '' ? [subject] : [subject, body];
  return ok(`${[...paragraphs, trailers.join('\n')].join('\n\n')}\n`);
}
