/**
 * Opening a project folder: project.json is read, migrated to the current version if needed and
 * validated with zod; a folder without git history gets one. Every failure is a typed error.
 */
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_FILE_VERSION, projectFileSchema, type ProjectFile } from '@reelforge/shared';
import { writeAtomic, writeJsonAtomic } from './atomic.js';
import { commitProjectChanges, hasRepository, initRepository } from './git-repo.js';
import type { GitOptions } from './git-runner.js';
import { DEFAULT_TEMPLATE_DIR, PROJECT_GITIGNORE, PROJECT_JSON } from './paths.js';
import { describeUnknown, err, errorCode, ok, projectError, tryIo, type Result } from './result.js';

/** Upgrades raw project.json content from version N to N+1 (key = N). */
export type ProjectMigration = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Version 1 is the first format: no migrations yet. Add `[1, (raw) => ...]` with version 2. */
export const PROJECT_MIGRATIONS: ReadonlyMap<number, ProjectMigration> = new Map();

export interface OpenedProject {
  /** Absolute project folder. */
  readonly dir: string;
  readonly project: ProjectFile;
  /** Version project.json had before it was migrated (and rewritten), or null. */
  readonly migratedFrom: number | null;
  /** True when the folder had no git repository and one was created. */
  readonly initializedGit: boolean;
}

export interface OpenProjectOptions {
  readonly git?: GitOptions;
  readonly migrations?: ReadonlyMap<number, ProjectMigration>;
  /** Source of `.gitignore` for folders without git history (default: repo templates/project). */
  readonly templateDir?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface MigrationOutcome {
  readonly value: unknown;
  readonly from: number | null;
}

/** Brings raw project.json content to PROJECT_FILE_VERSION (validation comes after). */
export function migrateProjectJson(
  raw: unknown,
  migrations: ReadonlyMap<number, ProjectMigration> = PROJECT_MIGRATIONS,
): Result<MigrationOutcome> {
  if (!isRecord(raw)) {
    return err(
      projectError('invalid', `${PROJECT_JSON} must contain a JSON object`, { path: PROJECT_JSON }),
    );
  }
  const version = raw['version'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return err(
      projectError(
        'invalid',
        `${PROJECT_JSON} has no valid "version" (expected ${String(PROJECT_FILE_VERSION)})`,
        {
          path: PROJECT_JSON,
        },
      ),
    );
  }
  if (version > PROJECT_FILE_VERSION) {
    return err(
      projectError(
        'unsupported-version',
        `${PROJECT_JSON} is version ${String(version)}, made by a newer ReelForge (this one reads up to ${String(PROJECT_FILE_VERSION)}); update the app`,
        { path: PROJECT_JSON },
      ),
    );
  }
  let current = raw;
  for (let from = version; from < PROJECT_FILE_VERSION; from += 1) {
    const migrate = migrations.get(from);
    if (!migrate) {
      return err(
        projectError(
          'unsupported-version',
          `${PROJECT_JSON} version ${String(from)} cannot be upgraded (no migration to ${String(from + 1)})`,
          { path: PROJECT_JSON },
        ),
      );
    }
    current = { ...migrate(current), version: from + 1 };
  }
  return ok({ value: current, from: version === PROJECT_FILE_VERSION ? null : version });
}

/** Editors on Windows may save JSON with a UTF-8 BOM. */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

async function readProjectJson(dir: string): Promise<Result<unknown>> {
  const file = path.join(dir, PROJECT_JSON);
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (errorCode(error) === 'ENOENT') {
      return err(
        projectError('not-a-project', `${dir} is not a ReelForge project (no ${PROJECT_JSON})`, {
          path: dir,
        }),
      );
    }
    return err(projectError('io', `${file}: ${describeUnknown(error)}`, { path: file }));
  }
  try {
    return ok(JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text));
  } catch (error) {
    return err(
      projectError('corrupt', `${PROJECT_JSON} is not valid JSON (${describeUnknown(error)})`, {
        path: file,
      }),
    );
  }
}

async function checkFolder(dir: string): Promise<Result<void>> {
  try {
    const info = await stat(dir);
    if (info.isDirectory()) return ok(undefined);
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') {
      return err(projectError('io', `${dir}: ${describeUnknown(error)}`, { path: dir }));
    }
  }
  return err(projectError('not-found', `project folder ${dir} does not exist`, { path: dir }));
}

/** Validates project.json against the schema of this app version. */
export function parseProjectFile(raw: unknown, file = PROJECT_JSON): Result<ProjectFile> {
  const parsed = projectFileSchema.safeParse(raw);
  if (parsed.success) return ok(parsed.data);
  const details = parsed.error.issues.map(
    (issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
  );
  return err(
    projectError(
      'invalid',
      `${PROJECT_JSON} does not match the project format: ${details[0] ?? ''}`,
      {
        path: file,
        details,
      },
    ),
  );
}

export async function openProject(
  dirInput: string,
  options: OpenProjectOptions = {},
): Promise<Result<OpenedProject>> {
  const dir = path.resolve(dirInput);
  const git = options.git ?? {};
  const folder = await checkFolder(dir);
  if (!folder.ok) return folder;
  const raw = await readProjectJson(dir);
  if (!raw.ok) return raw;
  const migrated = migrateProjectJson(raw.value, options.migrations);
  if (!migrated.ok) return migrated;
  const project = parseProjectFile(migrated.value.value, path.join(dir, PROJECT_JSON));
  if (!project.ok) return project;
  const from = migrated.value.from;
  if (from !== null) {
    const file = path.join(dir, PROJECT_JSON);
    const written = await tryIo(file, () => writeJsonAtomic(file, project.value));
    if (!written.ok) return written;
  }
  const initializedGit = !hasRepository(dir);
  if (initializedGit) {
    // A folder made by hand: keep heavy media out of the new history.
    const ignore = path.join(dir, PROJECT_GITIGNORE);
    if (!existsSync(ignore)) {
      const template = path.join(options.templateDir ?? DEFAULT_TEMPLATE_DIR, PROJECT_GITIGNORE);
      const copied = await tryIo(ignore, async () => writeAtomic(ignore, await readFile(template)));
      if (!copied.ok) return copied;
    }
    const init = await initRepository(dir, git);
    if (!init.ok) return init;
  }
  if (initializedGit || from !== null) {
    const message = initializedGit
      ? 'Start history'
      : `Migrate ${PROJECT_JSON} from version ${String(from)} to ${String(PROJECT_FILE_VERSION)}`;
    const commit = await commitProjectChanges(
      dir,
      message,
      'manual',
      initializedGit ? 'init-history' : 'migrate',
      git,
    );
    if (!commit.ok) return commit;
  }
  return ok({ dir, project: project.value, migratedFrom: from, initializedGit });
}
