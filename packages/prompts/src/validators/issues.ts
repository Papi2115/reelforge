/** Validation results shared by the stage output validators. */
import type { z } from 'zod';

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  readonly severity: Severity;
  /** Stable machine-readable code, e.g. `treatment-run`, `not-contiguous`. */
  readonly code: string;
  readonly message: string;
  /** JSON-ish location, e.g. `shots[3].t0`. */
  readonly path?: string;
}

export interface ValidationReport<T> {
  /** No `error` issue and the value parsed. Warnings do not make a report invalid. */
  readonly valid: boolean;
  /** The parsed value (also when only rule checks failed); undefined when unparseable. */
  readonly value: T | undefined;
  readonly issues: readonly ValidationIssue[];
}

export function issue(
  severity: Severity,
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return path === undefined ? { severity, code, message } : { severity, code, message, path };
}

export function report<T>(
  value: T | undefined,
  issues: readonly ValidationIssue[],
): ValidationReport<T> {
  return {
    valid: value !== undefined && issues.every((entry) => entry.severity !== 'error'),
    value,
    issues,
  };
}

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, index) => {
      if (typeof key === 'number') return `[${String(key)}]`;
      const name = String(key);
      return index === 0 ? name : `.${name}`;
    })
    .join('');
}

/** zod issues -> `schema` errors with readable paths. */
export function schemaIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((entry) =>
    issue(
      'error',
      'schema',
      entry.message,
      entry.path.length > 0 ? formatPath(entry.path) : undefined,
    ),
  );
}

/** JSON text -> value; tolerates one surrounding ``` fence (reported as a warning). */
export function parseJsonText(text: string): {
  readonly parsed: boolean;
  readonly value: unknown;
  readonly issues: ValidationIssue[];
} {
  const trimmed = text.trim();
  const fenced = /^```[a-zA-Z]*\n([\s\S]*?)\n?```$/.exec(trimmed);
  const body = fenced?.[1] ?? trimmed;
  const issues =
    fenced === null ? [] : [issue('warning', 'fenced-json', 'JSON wrapped in a ``` fence')];
  try {
    return { parsed: true, value: JSON.parse(body) as unknown, issues };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      parsed: false,
      value: undefined,
      issues: [...issues, issue('error', 'invalid-json', reason)],
    };
  }
}
