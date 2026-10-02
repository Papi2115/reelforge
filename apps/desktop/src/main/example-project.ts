/**
 * "Open the example project" (PLAN.md#10.3): copies the bundled example (templates/examples/) into
 * the projects folder under a unique name as a normal project (template CLAUDE.md, .gitignore,
 * style bibles, git history), then seeds the app state so the pipeline shows Script → Scenes as
 * done: the script approved, the voice-over imported (and, being synthesized, already clean) and
 * the stage states in pipeline.json. Sound design and Export are left for the user to run.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PipelineStateStore } from '@reelforge/claude-bridge';
import {
  autocommit,
  createProject,
  err,
  ok,
  writeAtomic,
  writeJsonAtomic,
  type GitOptions,
  type ProjectError,
  type Result,
} from '@reelforge/project';
import {
  projectFileSchema,
  VOICEOVER_RECORD_VERSION,
  voiceoverRecordSchema,
  type ProjectFile,
  type StageState,
  type VoiceoverRecord,
} from '@reelforge/shared';
import { newProjectDir } from './project-service.js';

/** Folder name of the bundled example inside `AppLayout.examplesDir`. */
export const EXAMPLE_ID = 'doom-on-a-calculator';
const VOICEOVER = 'audio/vo.original.wav';
const CLEAN_VOICEOVER = 'audio/vo.clean.wav';
/** Stages whose output ships with the example (the rest is the user's first run). */
export const EXAMPLE_DONE_STAGES = [
  'script',
  'voiceover',
  'clean',
  'words',
  'storyboard',
  'scenes',
  'sound-cues',
] as const;
const DONE_MESSAGE = 'Comes with the example project';
/** Copied by createProject from the app's template, or app state the example must not bring. */
const NOT_COPIED = new Set(['project.json', '.reelforge', '.git']);

export interface InstallExampleOptions {
  /** The example folder (`<examplesDir>/<EXAMPLE_ID>`). */
  readonly exampleDir: string;
  /** Parent of the copy (`Documents/ReelForge Projects`). */
  readonly projectsDir: string;
  readonly templateDir: string;
  readonly stylesDir: string;
  readonly git?: GitOptions;
  readonly now?: () => Date;
}

function failure(message: string, file?: string): ProjectError {
  return { kind: 'io', message, ...(file === undefined ? {} : { path: file }) };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function readExampleProject(exampleDir: string): Promise<Result<ProjectFile>> {
  const file = path.join(exampleDir, 'project.json');
  try {
    const parsed = projectFileSchema.safeParse(JSON.parse(await readFile(file, 'utf8')));
    if (parsed.success) return ok(parsed.data);
    return err({
      kind: 'invalid',
      message: `example ${file}: ${parsed.error.message}`,
      path: file,
    });
  } catch (error) {
    return err(failure(`the example project is missing or unreadable: ${describe(error)}`, file));
  }
}

/** Length of a PCM WAV file (null when the header is not one the app wrote or expects). */
export function wavDurationS(bytes: Buffer): number | null {
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF') return null;
  let offset = 12;
  let byteRate = 0;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === 'fmt ' && offset + 16 <= bytes.length) byteRate = bytes.readUInt32LE(offset + 16);
    if (id === 'data') return byteRate > 0 ? Math.round((size / byteRate) * 1000) / 1000 : null;
    offset += 8 + size + (size % 2);
  }
  return null;
}

async function seedVoiceover(dir: string, stamp: string): Promise<void> {
  const source = path.join(dir, ...VOICEOVER.split('/'));
  const bytes = await readFile(source);
  await writeAtomic(path.join(dir, ...CLEAN_VOICEOVER.split('/')), bytes);
  const record: VoiceoverRecord = voiceoverRecordSchema.parse({
    version: VOICEOVER_RECORD_VERSION,
    file: VOICEOVER,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    sourceName: path.basename(source),
    importedAt: stamp,
    durationS: wavDurationS(bytes),
    previous: null,
  });
  await writeJsonAtomic(path.join(dir, '.reelforge', 'voiceover.json'), record);
}

async function seedPipeline(dir: string, stamp: string, now: () => Date): Promise<Result<void>> {
  const store = new PipelineStateStore(now);
  const updated = await store.update(dir, (state) => {
    const stages: Record<string, StageState> = { ...state.stages };
    for (const stage of EXAMPLE_DONE_STAGES) {
      stages[stage] = {
        status: 'done',
        updatedAt: stamp,
        message: DONE_MESSAGE,
        ...(stage === 'script' ? { approvedAt: stamp } : {}),
      };
    }
    return { ...state, stages };
  });
  return updated.ok
    ? ok(undefined)
    : err(failure(`cannot write the pipeline state: ${updated.error.message}`));
}

/** Copies the example into a new folder of `projectsDir`; returns the new project folder. */
export async function installExampleProject(
  options: InstallExampleOptions,
): Promise<Result<string>> {
  const now = options.now ?? (() => new Date());
  const example = await readExampleProject(options.exampleDir);
  if (!example.ok) return example;
  const { title, language, style, fps, seed } = example.value;
  try {
    await mkdir(options.projectsDir, { recursive: true });
  } catch (error) {
    return err(failure(`cannot create ${options.projectsDir}: ${describe(error)}`));
  }
  const git = options.git === undefined ? {} : { git: options.git };
  const created = await createProject({
    dir: newProjectDir(options.projectsDir, title),
    title,
    language,
    style,
    fps,
    seed,
    templateDir: options.templateDir,
    stylesDir: options.stylesDir,
    ...git,
  });
  if (!created.ok) return created;
  const dir = created.value.dir;
  const stamp = now().toISOString();
  try {
    await cp(options.exampleDir, dir, {
      recursive: true,
      filter: (source) => !NOT_COPIED.has(path.relative(options.exampleDir, source)),
    });
    await seedVoiceover(dir, stamp);
  } catch (error) {
    return err(failure(`cannot copy the example project into ${dir}: ${describe(error)}`, dir));
  }
  const committed = await autocommit(dir, 'Add the example project', {
    kind: 'pipeline-step',
    step: 'example',
    ...git,
  });
  if (!committed.ok) return committed;
  const seeded = await seedPipeline(dir, stamp, now);
  return seeded.ok ? ok(dir) : seeded;
}
