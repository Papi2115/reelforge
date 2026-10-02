/**
 * Props the storyboard already flagged as missing (`storyboard.json` top-level `missingProps`,
 * e.g. `"z80Chip (voxel IC package …)"`): built before the first scene-build turn, so scenes can
 * use them right away instead of reporting them `MISSING:` one shot at a time (PLAN.md#7.4).
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import { storyboardOutputSchema } from '@reelforge/prompts';
import type { StoryboardShot } from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { FILES } from '../paths.js';
import type { StageError } from '../types.js';
import { parsePropEntry, type PropBuilder, type PropOutcome, type PropRequest } from './builder.js';

function mentions(shot: StoryboardShot, raw: string, name: string): boolean {
  const intent = shot.intent.toLowerCase();
  return intent.includes(raw.toLowerCase()) || intent.includes(name.toLowerCase());
}

/** The storyboard's missing props as build requests (unreadable entries are skipped). */
export async function storyboardPropRequests(
  projectDir: string,
  shots: readonly StoryboardShot[],
): Promise<Result<PropRequest[], StageError>> {
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
  const parsed = storyboardOutputSchema.safeParse(raw);
  if (!parsed.success) return ok([]);
  const requests = new Map<string, PropRequest>();
  for (const entry of parsed.data.missingProps ?? []) {
    const prop = parsePropEntry(entry);
    if (prop === undefined || requests.has(prop.name)) continue;
    const head = entry.split(/[(:—–]/)[0]?.trim() ?? prop.name;
    requests.set(prop.name, {
      ...prop,
      shots: shots.filter((shot) => mentions(shot, head, prop.name)),
    });
  }
  return ok([...requests.values()]);
}

/** Builds the storyboard's missing props the kit and the project do not have yet. */
export async function buildStoryboardProps(
  builder: PropBuilder,
  projectDir: string,
  shots: readonly StoryboardShot[],
): Promise<Result<PropOutcome[], StageError>> {
  const requests = await storyboardPropRequests(projectDir, shots);
  if (!requests.ok) return requests;
  const outcomes: PropOutcome[] = [];
  for (const request of requests.value) {
    const outcome = await builder.ensure(request);
    if (!outcome.ok) return outcome;
    outcomes.push(outcome.value);
  }
  return ok(outcomes);
}
