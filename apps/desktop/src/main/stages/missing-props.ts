/**
 * Props a scene build asked for that the kit lacks (PLAN.md#7.4): the shot keeps a fallback
 * (⚠ "missing prop: …"), and the app logs the names to `.reelforge/missing-props.json` for the
 * developer — extending the kit is a repo-level change, never an edit inside a user project.
 */
import { readFile } from 'node:fs/promises';
import { writeJsonAtomic } from '@reelforge/project';
import {
  MISSING_PROPS_VERSION,
  missingPropsFileSchema,
  type MissingPropEntry,
  type MissingPropsFile,
} from '@reelforge/shared';
import { inProject, type MissingPropsHandler } from '@reelforge/stages';
import { describeError, type Logger } from '../logger.js';

export const MISSING_PROPS_FILE = '.reelforge/missing-props.json';

/** The log with `names` of `shotId` merged in (pure). */
export function mergeMissingProps(
  current: MissingPropsFile | undefined,
  names: readonly string[],
  shotId: string,
  stamp: string,
): MissingPropsFile {
  const entries = new Map<string, MissingPropEntry>(
    (current?.entries ?? []).map((entry) => [entry.name, entry]),
  );
  for (const name of names) {
    const known = entries.get(name);
    entries.set(name, {
      name,
      shots: [...new Set([...(known?.shots ?? []), shotId])].sort(),
      firstSeenAt: known?.firstSeenAt ?? stamp,
      lastSeenAt: stamp,
    });
  }
  return {
    version: MISSING_PROPS_VERSION,
    updatedAt: stamp,
    entries: [...entries.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Reads the log; a missing or invalid file reads as empty (it is rebuilt by the next write). */
export async function readMissingProps(projectDir: string): Promise<MissingPropsFile | undefined> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(inProject(projectDir, MISSING_PROPS_FILE), 'utf8'),
    );
    const parsed = missingPropsFileSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined; // not written yet (or unreadable): treated as an empty log
  }
}

/** The scene stage's handler: logs the names, keeps the shot with its fallback (`skipped`). */
export function loggingMissingProps(
  projectDir: string,
  log: Logger,
  now: () => Date = () => new Date(),
): MissingPropsHandler {
  let writes: Promise<void> = Promise.resolve();
  return async (names, shot) => {
    log.warn(`shot ${shot.id}: the kit is missing ${names.join(', ')} (a fallback is used)`);
    writes = writes.then(async () => {
      try {
        const merged = mergeMissingProps(
          await readMissingProps(projectDir),
          names,
          shot.id,
          now().toISOString(),
        );
        await writeJsonAtomic(inProject(projectDir, MISSING_PROPS_FILE), merged);
      } catch (error) {
        log.warn(`${MISSING_PROPS_FILE} not written: ${describeError(error)}`);
      }
    });
    await writes;
    return 'skipped';
  };
}
