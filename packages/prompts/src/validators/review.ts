/**
 * Whole-video review replies (PLAN.md#7.6): the Haiku triage (`{"suspects":[{shot, reason}]}`)
 * and the Sonnet fix plan (`{"fixes":[{shot, change}]}`). Entries for unknown shots are dropped
 * with a warning; a shot named twice keeps its first entry. A JSON object inside a chatty reply
 * (fenced JSON followed by prose, real run Sketchbook 1) is taken with a warning.
 */
import { z } from 'zod';
import { parseEmbeddedJsonText } from './embedded-json.js';
import {
  issue,
  report,
  schemaIssues,
  type ValidationIssue,
  type ValidationReport,
} from './issues.js';

export const triageReplySchema = z.strictObject({
  suspects: z.array(z.strictObject({ shot: z.string().min(1), reason: z.string().min(1) })),
});
export type TriageReply = z.infer<typeof triageReplySchema>;

export const planReplySchema = z.strictObject({
  fixes: z.array(z.strictObject({ shot: z.string().min(1), change: z.string().min(1) })),
});
export type PlanReply = z.infer<typeof planReplySchema>;

export interface ReviewReplyOptions {
  /** Storyboard shot ids; entries naming other shots are dropped. */
  readonly shotIds: readonly string[];
}

/** Keeps the first entry per known shot; reports unknown and repeated shots as warnings. */
function knownShots<T extends { readonly shot: string }>(
  entries: readonly T[],
  field: string,
  shotIds: readonly string[],
): { kept: T[]; issues: ValidationIssue[] } {
  const known = new Set(shotIds);
  const seen = new Set<string>();
  const kept: T[] = [];
  const issues: ValidationIssue[] = [];
  entries.forEach((entry, index) => {
    const at = `${field}[${String(index)}].shot`;
    if (!known.has(entry.shot)) {
      issues.push(issue('warning', 'unknown-shot', `no shot "${entry.shot}"`, at));
    } else if (seen.has(entry.shot)) {
      issues.push(issue('warning', 'repeated-shot', `"${entry.shot}" is listed twice`, at));
    } else {
      seen.add(entry.shot);
      kept.push(entry);
    }
  });
  return { kept, issues };
}

function validateReply<T>(
  text: string,
  schema: z.ZodType<T>,
): { value: T | undefined; issues: ValidationIssue[] } {
  const json = parseEmbeddedJsonText(text);
  if (!json.parsed) return { value: undefined, issues: json.issues };
  const parsed = schema.safeParse(json.value);
  if (!parsed.success)
    return { value: undefined, issues: [...json.issues, ...schemaIssues(parsed.error)] };
  return { value: parsed.data, issues: json.issues };
}

export function validateTriageReply(
  text: string,
  options: ReviewReplyOptions,
): ValidationReport<TriageReply> {
  const checked = validateReply(text, triageReplySchema);
  if (checked.value === undefined) return report<TriageReply>(undefined, checked.issues);
  const { kept, issues } = knownShots(checked.value.suspects, 'suspects', options.shotIds);
  return report({ suspects: kept }, [...checked.issues, ...issues]);
}

export function validatePlanReply(
  text: string,
  options: ReviewReplyOptions,
): ValidationReport<PlanReply> {
  const checked = validateReply(text, planReplySchema);
  if (checked.value === undefined) return report<PlanReply>(undefined, checked.issues);
  const { kept, issues } = knownShots(checked.value.fixes, 'fixes', options.shotIds);
  return report({ fixes: kept }, [...checked.issues, ...issues]);
}
