/**
 * Everything a scene job (build, QA, review) works with: the stage context, the scene tools with
 * their defaults, and the project inputs read once per run (storyboard, words, style, locks).
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { AnchorIndex } from '@reelforge/pipeline';
import {
  projectLookMode,
  storyboardFileSchema,
  wordsFileSchema,
  type LookMode,
  type StoryboardShot,
  type WordsFile,
} from '@reelforge/shared';
import { readProjectText, requireProjectJson } from '../files.js';
import { readLockedShots } from '../locks.js';
import { FILES } from '../paths.js';
import { PropBuilder } from '../props/builder.js';
import type { SceneSettings } from '../settings.js';
import { stageError, type StageContext, type StageError } from '../types.js';
import {
  kitNamesFromCatalog,
  type FrameRenderer,
  type KitNames,
  type MissingPropsHandler,
} from './tools.js';

export interface SceneJob {
  readonly ctx: StageContext;
  readonly frames: FrameRenderer;
  /** A custom missing-props decision; undefined = build project props (`props`). */
  readonly onMissingProps: MissingPropsHandler | undefined;
  /** Builds missing props as project props (kit-ext), shared by the shots of this run. */
  readonly props: PropBuilder;
  /** The installed kit's names (project props: `projectPropNames`). */
  readonly kitNames: KitNames;
  readonly settings: SceneSettings;
  readonly styleId: string;
  /** Project look mode (ADR-009): `voxel-only` builds every shot as before looks. */
  readonly lookMode: LookMode;
  readonly shots: readonly StoryboardShot[];
  readonly words: WordsFile | undefined;
  /** Fuzzy anchor resolver over the words (sync checks); undefined before "Words timed". */
  readonly anchorIndex: AnchorIndex | undefined;
  /** Shots locked by the user (`locks.json`, PLAN.md#11.4): never built or fixed. */
  readonly locked: ReadonlySet<string>;
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
  const locked = await readLockedShots(ctx.projectDir);
  if (!locked.ok) return locked;
  const kitNames = tools.kitNames ?? (defaultKitNames ??= kitNamesFromCatalog());
  const settings = ctx.settings.scenes;
  const styleId = project.value.style;
  return ok({
    ctx,
    frames: tools.frames,
    onMissingProps: tools.onMissingProps,
    props: new PropBuilder({ ctx, frames: tools.frames, settings, styleId }, kitNames.props),
    kitNames,
    settings,
    styleId,
    lookMode: projectLookMode(project.value),
    shots: storyboard.value.shots,
    words: words.value,
    anchorIndex:
      words.value === undefined
        ? undefined
        : new AnchorIndex(words.value.words, { lang: project.value.language }),
    locked: locked.value,
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
