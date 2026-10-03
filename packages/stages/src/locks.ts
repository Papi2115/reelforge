/**
 * Shot locks (PLAN.md#11.4): `locks.json` in the project root (tracked by git, so revert and the
 * history keep it next to the scenes it protects). A locked shot's scene file and the project
 * props (kit-ext) its scene calls are "locked files": stages skip the shot, and every Claude turn
 * is followed by a check that puts locked files back (lock-guard.ts).
 */
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { JsonFileStore, err, ok, type Result } from '@reelforge/claude-bridge';
import {
  KIT_EXT_PROPS_DIR,
  PROP_NAME_PATTERN,
  SHOT_LOCKS_FILE,
  emptyShotLocks,
  lockedShotIds,
  propExtensionFile,
  shotLocksFileSchema,
  storyboardFileSchema,
  withShotsLocked,
  type ShotLocksFile,
} from '@reelforge/shared';
import { readProjectText } from './files.js';
import { FILES, inProject } from './paths.js';
import { stageError, type StageError } from './types.js';

const locks = new JsonFileStore<ShotLocksFile>(shotLocksFileSchema, emptyShotLocks);

const describe = (error: { readonly message: string }): StageError =>
  stageError('invalid-input', `${SHOT_LOCKS_FILE}: ${error.message}`);

/** The project's locks (none when the file does not exist). */
export async function readShotLocks(
  projectDir: string,
): Promise<Result<ShotLocksFile, StageError>> {
  const read = await locks.read(inProject(projectDir, SHOT_LOCKS_FILE));
  return read.ok ? read : err(describe(read.error));
}

export async function readLockedShots(
  projectDir: string,
): Promise<Result<ReadonlySet<string>, StageError>> {
  const read = await readShotLocks(projectDir);
  return read.ok ? ok(lockedShotIds(read.value)) : read;
}

/** Locks or unlocks shots (serialized read-modify-write, atomic). */
export async function setShotsLocked(
  projectDir: string,
  ids: readonly string[],
  locked: boolean,
  now: Date,
): Promise<Result<ShotLocksFile, StageError>> {
  const written = await locks.update(inProject(projectDir, SHOT_LOCKS_FILE), (current) =>
    withShotsLocked(current, ids, locked, now),
  );
  return written.ok ? written : err(describe(written.error));
}

/** A file a lock protects: a locked shot's scene, or a project prop a locked scene calls. */
export interface LockedFile {
  /** Project-relative, forward slashes. */
  readonly file: string;
  readonly kind: 'scene' | 'prop';
  /** The locked shots it belongs to. */
  readonly shotIds: readonly string[];
}

/** `props.<name>(` calls of a scene (`kit.props.fridge(` and destructured `props.fridge(`). */
export function propCalls(source: string): string[] {
  const names = [...source.matchAll(/\bprops\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/g)].map(
    (match) => match[1] ?? '',
  );
  return [...new Set(names.filter((name) => name !== ''))];
}

async function projectProps(projectDir: string): Promise<Set<string>> {
  const directory = inProject(projectDir, KIT_EXT_PROPS_DIR);
  if (!existsSync(directory)) return new Set();
  const names = (await readdir(directory))
    .filter((file) => file.endsWith('.js'))
    .map((file) => file.slice(0, -'.js'.length));
  return new Set(names.filter((name) => PROP_NAME_PATTERN.test(name)));
}

/** Scene path per shot id from storyboard.json (`scenes/<id>.js` when it cannot be read). */
async function scenePaths(projectDir: string): Promise<Map<string, string>> {
  const text = await readProjectText(projectDir, FILES.storyboard);
  if (!text.ok || text.value === undefined) return new Map();
  try {
    const parsed = storyboardFileSchema.safeParse(JSON.parse(text.value));
    return parsed.success
      ? new Map(parsed.data.shots.map((shot) => [shot.id, shot.scene]))
      : new Map();
  } catch {
    return new Map(); // unreadable storyboard: the conventional scene paths are used
  }
}

/** The files the given locked shots protect. */
export async function lockedFiles(
  projectDir: string,
  locked: ReadonlySet<string>,
): Promise<Result<LockedFile[], StageError>> {
  if (locked.size === 0) return ok([]);
  const [scenes, props] = await Promise.all([scenePaths(projectDir), projectProps(projectDir)]);
  const files: LockedFile[] = [];
  const propShots = new Map<string, string[]>();
  for (const shotId of [...locked].sort()) {
    const scene = scenes.get(shotId) ?? `${FILES.scenesDir}/${shotId}.js`;
    files.push({ file: scene, kind: 'scene', shotIds: [shotId] });
    const source = await readProjectText(projectDir, scene);
    if (!source.ok) return source;
    for (const name of propCalls(source.value ?? '')) {
      if (props.has(name)) propShots.set(name, [...(propShots.get(name) ?? []), shotId]);
    }
  }
  for (const [name, shotIds] of propShots) {
    files.push({ file: propExtensionFile(name), kind: 'prop', shotIds });
  }
  return ok(files);
}
