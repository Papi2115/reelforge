/**
 * Project roles (PLAN.md#12.20, ADR-026): people the character pack lacks (a firefighter, a
 * judge), built on demand in the pack's style as `characters/roles/<id>.json` (a role spec of the
 * kit, `kit.cast.person('<id>')`), with optional accessory extensions
 * `characters/accessories/<id>.json` when the vocabulary lacks an essential piece. Both are
 * tracked in the project's git; the render manifest inlines their texts (`castRoles`) so the
 * sandboxed engine never reads the disk. `.reelforge/roles-report.json` records every build.
 */
import { z } from 'zod';
import { normalizePropName } from './kit-extensions.js';

/** Project-relative folders (forward slashes). */
export const CAST_ROLES_DIR = 'characters/roles';
export const CAST_ACCESSORIES_DIR = 'characters/accessories';

/** Role and accessory ids: camelCase, at most 32 characters (`kit.cast.person('policeOfficer')`). */
export const CAST_FILE_ID_PATTERN = /^[a-z][A-Za-z0-9]{0,31}$/;

export const castFileIdSchema = z
  .string()
  .regex(CAST_FILE_ID_PATTERN, 'camelCase id of at most 32 characters, e.g. policeOfficer');

export function castRoleFile(id: string): string {
  return `${CAST_ROLES_DIR}/${id}.json`;
}

export function castAccessoryFile(id: string): string {
  return `${CAST_ACCESSORIES_DIR}/${id}.json`;
}

/** `characters/roles/x.json` -> `{ kind: 'role', id: 'x' }` (also accessories); else undefined. */
export function castFileOf(
  file: string,
): { readonly kind: 'role' | 'accessory'; readonly id: string } | undefined {
  const match = /^characters\/(roles|accessories)\/([^/]+)\.json$/.exec(file.replaceAll('\\', '/'));
  const id = match?.[2];
  if (match === null || id === undefined || !CAST_FILE_ID_PATTERN.test(id)) return undefined;
  return { kind: match[1] === 'roles' ? 'role' : 'accessory', id };
}

/**
 * A role name as the storyboard or a scene writes it (`police-officer`, `Police officer`) as the
 * role id (`policeOfficer`); undefined when nothing usable is left or it is too long.
 */
export function castRoleId(raw: string): string | undefined {
  const id = normalizePropName(raw);
  return id !== undefined && CAST_FILE_ID_PATTERN.test(id) ? id : undefined;
}

/** One project file inlined into the render manifest. */
export const castFileSourceSchema = z.object({
  id: castFileIdSchema,
  /** Project-relative path (messages). */
  file: z.string().min(1),
  /** JSON text, parsed and validated by the kit in the engine. */
  source: z.string().min(1),
});
export type CastFileSourceEntry = z.infer<typeof castFileSourceSchema>;

/** Manifest field `castRoles`: the project's roles and accessory extensions. */
export const manifestCastRolesSchema = z
  .object({
    roles: z.array(castFileSourceSchema),
    accessories: z.array(castFileSourceSchema),
  })
  .superRefine((cast, issues) => {
    for (const key of ['roles', 'accessories'] as const) {
      const seen = new Set<string>();
      cast[key].forEach((entry, index) => {
        if (seen.has(entry.id)) {
          issues.addIssue({
            code: 'custom',
            message: `duplicate ${key === 'roles' ? 'role' : 'accessory'} "${entry.id}"`,
            path: [key, index, 'id'],
          });
        }
        seen.add(entry.id);
      });
    }
  });
export type ManifestCastRoles = z.infer<typeof manifestCastRolesSchema>;

export const ROLES_REPORT_VERSION = 1;

/**
 * `built`: QA passed; `warning`: usable, but a QA check or the critic found a problem (⚠);
 * `failed`: no valid role file (moved aside, its shots keep a cast member).
 */
export const roleBuildStatusSchema = z.enum(['built', 'warning', 'failed']);
export type RoleBuildStatus = z.infer<typeof roleBuildStatusSchema>;

export const roleBuildRecordSchema = z.object({
  id: castFileIdSchema,
  status: roleBuildStatusSchema,
  /** Project-relative role file (`characters/roles/<id>.json`). */
  file: z.string().min(1),
  /** What the role must look like (storyboard `newRoles`, or the shot that asked for it). */
  description: z.string(),
  /** Shots that need it (storyboard ids). */
  shots: z.array(z.string().min(1)),
  /** Role turns run (build + fixes). */
  attempts: z.int().nonnegative(),
  /** Accessory extensions the role uses (`characters/accessories/<id>.json`). */
  accessories: z.array(z.string()),
  /** Project-relative QA sheet (4 angles + 2 poses) of the last round. */
  sheet: z.string().optional(),
  /** Problems left after the last QA round (empty when built). */
  findings: z.array(z.string()),
  notes: z.array(z.string()),
  updatedAt: z.iso.datetime(),
});
export type RoleBuildRecord = z.infer<typeof roleBuildRecordSchema>;

/** `.reelforge/roles-report.json`: every role built (or attempted) for this project. */
export const rolesReportSchema = z.object({
  version: z.literal(ROLES_REPORT_VERSION),
  updatedAt: z.iso.datetime(),
  roles: z.array(roleBuildRecordSchema),
});
export type RolesReport = z.infer<typeof rolesReportSchema>;
