/**
 * Roles a scene asks for by calling `kit.cast.person('<id>')`, `kit.cast.role('<id>')` or
 * `kit.cast.spec('<id>')` with an id the pack and the project do not have (PLAN.md#12.20): built
 * as project roles before the shot's QA. The scene already names the id, so no rebuild turn is
 * needed; a role that cannot be built makes the shot's render fail with the kit's "unknown person"
 * error, and the QA fix turn replaces it with a cast member.
 */
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { ok, type Result } from '@reelforge/claude-bridge';
import { PACK_IDS } from '@reelforge/kit';
import {
  CAST_FILE_ID_PATTERN,
  CAST_ROLES_DIR,
  castRoleId,
  type StoryboardShot,
} from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { inProject } from '../paths.js';
import type { SceneJob } from '../scenes/job.js';
import type { StageError } from '../types.js';

const CAST_CALL = /\bcast\s*\.\s*(?:person|role|spec)\s*\(\s*(['"`])([^'"`\n]{1,48})\1/g;

/** Ids of `kit.cast.person/role/spec('<id>')` calls, as role ids, in order of first use. */
export function calledRoleIds(source: string): string[] {
  const ids = [...source.matchAll(CAST_CALL)]
    .map((match) => castRoleId(match[2] ?? ''))
    .filter((id): id is string => id !== undefined);
  return [...new Set(ids)];
}

/** Ids of the project's role files right now. */
export async function projectRoleIds(projectDir: string): Promise<Set<string>> {
  const directory = inProject(projectDir, CAST_ROLES_DIR);
  if (!existsSync(directory)) return new Set();
  const ids = (await readdir(directory))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .filter((id) => CAST_FILE_ID_PATTERN.test(id));
  return new Set(ids);
}

/** Builds the roles `shot`'s scene calls but nobody has; returns notes for the shot record. */
export async function provideSceneRoles(
  job: SceneJob,
  shot: StoryboardShot,
): Promise<Result<string[], StageError>> {
  const source = await readProjectText(job.ctx.projectDir, shot.scene);
  if (!source.ok) return source;
  if (source.value === undefined) return ok([]);
  const known = await projectRoleIds(job.ctx.projectDir);
  const missing = calledRoleIds(source.value).filter(
    (id) => !PACK_IDS.includes(id) && !known.has(id),
  );
  if (missing.length === 0) return ok([]);
  job.ctx.step(`${shot.id}: building roles ${missing.join(', ')}`);
  const provided = await job.roles.ensureIds(missing, shot);
  if (!provided.ok) return provided;
  const { built, failed } = provided.value;
  return ok([
    `missing roles ${missing.join(', ')}: built ${built.join(', ') || 'none'}${failed.length > 0 ? `, could not build ${failed.join(', ')}` : ''}`,
  ]);
}
