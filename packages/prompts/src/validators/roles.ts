/**
 * The output of the `roles` prompt (PLAN.md#12.20, ADR-026): `characters/roles/<id>.json`, one
 * role spec plus optional `notes`. Structural checks only (JSON object, the id of the file, the
 * required fields, known field names); the vocabulary, colours and the QA render are checked by
 * the kit and the stage (`reelforge cast check`).
 */
import { issue, report, type ValidationIssue, type ValidationReport } from './issues.js';

/** Top-level fields of a role file (the kit's role spec + `notes`). */
export const ROLE_FILE_FIELDS = [
  'version',
  'id',
  'label',
  'description',
  'body',
  'skin',
  'hair',
  'headgear',
  'top',
  'layers',
  'legs',
  'shoes',
  'eyes',
  'accessories',
  'held',
  'notes',
] as const;

const REQUIRED = ['id', 'label', 'top', 'legs', 'shoes'] as const;

/** A role file as parsed JSON (the kit validates the spec). */
export type RoleFile = Readonly<Record<string, unknown>>;

export interface RoleFileOptions {
  /** The id the file must have (its file name without `.json`). */
  readonly roleId: string;
}

export function validateRoleFile(
  text: string,
  options: RoleFileOptions,
): ValidationReport<RoleFile> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return report<RoleFile>(undefined, [
      issue('error', 'role-json', `not valid JSON (${error.message})`),
    ]);
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return report<RoleFile>(undefined, [
      issue('error', 'role-object', 'a role file is one JSON object'),
    ]);
  }
  const spec = value as RoleFile;
  const issues: ValidationIssue[] = [];
  for (const field of REQUIRED) {
    if (spec[field] === undefined) issues.push(issue('error', 'role-field', `missing "${field}"`));
  }
  if (spec['id'] !== undefined && spec['id'] !== options.roleId) {
    issues.push(
      issue(
        'error',
        'role-id',
        `id is ${JSON.stringify(spec['id'])}, expected "${options.roleId}"`,
      ),
    );
  }
  for (const key of Object.keys(spec)) {
    if (!(ROLE_FILE_FIELDS as readonly string[]).includes(key)) {
      issues.push(issue('error', 'role-unknown-field', `unknown field "${key}"`, key));
    }
  }
  const notes = spec['notes'];
  if (notes !== undefined && typeof notes !== 'string') {
    issues.push(issue('error', 'role-notes', 'notes must be a string', 'notes'));
  }
  return report(spec, issues);
}
