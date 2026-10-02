/**
 * Everything a scene job (build, QA, review) works with: the stage context, the scene tools with
 * their defaults, and the project inputs read once per run (storyboard, words, style).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { AnchorIndex } from '@reelforge/pipeline';
import {
  storyboardFileSchema,
  wordsFileSchema,
  type StoryboardShot,
  type WordsFile,
} from '@reelforge/shared';
import { readProjectText, requireProjectJson } from '../files.js';
import { FILES } from '../paths.js';
import type { SceneSettings } from '../settings.js';
import { stageError, type StageContext, type StageError } from '../types.js';
import {
  kitNamesFromCatalog,
  skipMissingProps,
  type FrameRenderer,
  type KitNames,
  type MissingPropsHandler,
} from './tools.js';

export interface SceneJob {
  readonly ctx: StageContext;
  readonly frames: FrameRenderer;
  readonly onMissingProps: MissingPropsHandler;
  readonly kitNames: KitNames;
  readonly settings: SceneSettings;
  readonly styleId: string;
  readonly shots: readonly StoryboardShot[];
  readonly words: WordsFile | undefined;
  /** Fuzzy anchor resolver over the words (sync checks); undefined before "Words timed". */
  readonly anchorIndex: AnchorIndex | undefined;
}

let defaultKitNames: KitNames | undefined;

async function readWords(projectDir: string): Promise<Result<WordsFile | undefined, StageError>> {
  const text = await readProjectText(projectDir, FILES.words);
  if (!text.ok || text.value === undefined) return text.ok ? ok(undefined) : text;
  return requireProjectJson(projectDir, FILES.words, wordsFileSchema);
}

export async function loadSceneJob(ctx: StageContext): Promise<Result<SceneJob, StageError>> {
  const tools = ctx.scenes;
  if (tools === undefined) {
    return err(stageError('missing-tool', 'no frame renderer: scenes cannot be checked'));
  }
  const { project } = ctx.snapshot;
  if (project.status !== 'ok') return err(stageError('not-ready', 'project.json is invalid'));
  const storyboard = await requireProjectJson(
    ctx.projectDir,
    FILES.storyboard,
    storyboardFileSchema,
  );
  if (!storyboard.ok) return storyboard;
  const words = await readWords(ctx.projectDir);
  if (!words.ok) return words;
  return ok({
    ctx,
    frames: tools.frames,
    onMissingProps: tools.onMissingProps ?? skipMissingProps,
    kitNames: tools.kitNames ?? (defaultKitNames ??= kitNamesFromCatalog()),
    settings: ctx.settings.scenes,
    styleId: project.value.style,
    shots: storyboard.value.shots,
    words: words.value,
    anchorIndex:
      words.value === undefined
        ? undefined
        : new AnchorIndex(words.value.words, { lang: project.value.language }),
  });
}

/** Storyboard shots with the given ids (all when undefined); unknown ids are an error. */
export function selectShots(
  job: SceneJob,
  ids: readonly string[] | undefined,
): Result<StoryboardShot[], StageError> {
  if (ids === undefined) return ok([...job.shots]);
  const known = new Set(job.shots.map((shot) => shot.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    return err(
      stageError('invalid-input', `unknown shots: ${unknown.join(', ')}`, [
        `storyboard shots: ${[...known].join(', ')}`,
      ]),
    );
  }
  const wanted = new Set(ids);
  return ok(job.shots.filter((shot) => wanted.has(shot.id)));
}
