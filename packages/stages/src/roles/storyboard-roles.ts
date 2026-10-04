/**
 * Roles the storyboard already asked for (`storyboard.json` top-level `newRoles`, PLAN.md#12.20:
 * `[{ id: "firefighter", description: "helmet, turnout coat, axe" }]`, pack projects): built
 * before the first scene-build turn, so every scene can call `kit.cast.person('<id>')` at once.
 * Read leniently: an entry without a usable id is skipped (the storyboard validator reports it).
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import { castRoleId, type StoryboardShot } from '@reelforge/shared';
import { z } from 'zod';
import { readProjectText } from '../files.js';
import { FILES } from '../paths.js';
import type { StageError } from '../types.js';
import type { RoleBuilder, RoleOutcome, RoleRequest } from './builder.js';

const storyboardRolesSchema = z.looseObject({
  newRoles: z.array(z.looseObject({ id: z.string(), description: z.string() })).optional(),
});

/** Words of an id (`police-officer`, `policeOfficer` -> `police officer`). */
function words(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('-', ' ')
    .toLowerCase();
}

/** The storyboard's new roles as build requests, with the shots that mention them. */
export async function storyboardRoleRequests(
  projectDir: string,
  shots: readonly StoryboardShot[],
): Promise<Result<RoleRequest[], StageError>> {
  const text = await readProjectText(projectDir, FILES.storyboard);
  if (!text.ok) return text;
  if (text.value === undefined) return ok([]);
  let raw: unknown;
  try {
    raw = JSON.parse(text.value);
  } catch (error) {
    if (error instanceof SyntaxError) return ok([]);
    throw error;
  }
  const parsed = storyboardRolesSchema.safeParse(raw);
  if (!parsed.success) return ok([]);
  const requests = new Map<string, RoleRequest>();
  for (const entry of parsed.data.newRoles ?? []) {
    const id = castRoleId(entry.id);
    if (id === undefined || requests.has(id)) continue;
    const name = words(entry.id);
    requests.set(id, {
      id,
      description: entry.description,
      shots: shots.filter((shot) => shot.intent.toLowerCase().includes(name)),
    });
  }
  return ok([...requests.values()]);
}

/** Builds the storyboard's new roles the project does not have yet. */
export async function buildStoryboardRoles(
  builder: RoleBuilder,
  projectDir: string,
  shots: readonly StoryboardShot[],
): Promise<Result<RoleOutcome[], StageError>> {
  const requests = await storyboardRoleRequests(projectDir, shots);
  if (!requests.ok) return requests;
  const outcomes: RoleOutcome[] = [];
  for (const request of requests.value) {
    const outcome = await builder.ensure(request);
    if (!outcome.ok) return outcome;
    outcomes.push(outcome.value);
  }
  return ok(outcomes);
}
