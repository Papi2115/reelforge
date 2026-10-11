/**
 * One QA round of a shot, run by code after every Claude turn (Claude's self-report is not
 * trusted), PLAN.md §4.4: determinism lint → smoke render at 5 points (console errors captured)
 * → programmatic checks (blank, cards, anchors ±150 ms) → Haiku critic on a contact sheet.
 * The critic only runs when the code checks are clean (their findings are fixed first).
 */
import { lintScene } from '@reelforge/engine';
import { ok, type Result } from '@reelforge/claude-bridge';
import { criticCharacterVars, criticDirectionVars } from '@reelforge/prompts';
import {
  isEndCardShot,
  type CriticVerdictRecord,
  type QaFinding,
  type StoryboardShot,
} from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { criticLookVars } from '../looks.js';
import { criticWorldPromptVars } from '../worlds.js';
import { criticMinModel, criticReferenceVars, worldQaTimes } from '../c-cam/critic.js';
import { FILES } from '../paths.js';
import { shortCopyFindings, shortMotionFindings } from '../shorts/scene-checks.js';
import { slopShotFindings } from '../slop/guards.js';
import { SCENE_STUB_MARKER } from '../stages/scene-stub.js';
import type { StageError } from '../types.js';
import {
  consoleFindings,
  finding,
  fixableFindings,
  lintFindings,
  renderTimeoutFinding,
} from './checks.js';
import { critiqueFrames, programmaticCritique, type TurnRunner } from './critic.js';
import type { SceneJob } from './job.js';
import { renderShot } from './render.js';
import { researchExcerpt, shotFocus } from './research-excerpt.js';
import { assetSizeFindings } from './source-checks.js';
import { cameraInterruptFindings } from './source-checks-camera.js';
import { characterSourceFindings } from './source-checks-characters.js';
import { offensiveSourceFindings } from './source-checks-offensive.js';
import { shotSyncEvents, syncFindings } from './sync.js';
import { worldAssetRefFindings } from '../world-assets/refs.js';
import type { ShotRender } from './tools.js';

export interface QaResult {
  readonly findings: readonly QaFinding[];
  readonly verdicts: readonly CriticVerdictRecord[];
  readonly sheet: string | undefined;
  readonly notes: readonly string[];
  /** The scene source that was checked (undefined: no file). */
  readonly source: string | undefined;
  readonly render: ShotRender | undefined;
}

/** start, 25 %, 50 %, 75 %, end − 0.1 s (local seconds, ms precision, unique). */
export function smokeTimes(duration: number): number[] {
  const points = [0, 0.25, 0.5, 0.75].map((share) => share * duration);
  points.push(Math.max(0, duration - 0.1));
  const rounded = points.map((t) => Math.round(t * 1000) / 1000);
  return [...new Set(rounded)].sort((first, second) => first - second);
}

export function qaSheetFile(shotId: string, label: string): string {
  return `${FILES.qaFramesDir}/${shotId}/${label}.png`;
}

/**
 * Whether the Haiku critic looks at this shot: always, unless faster checks sample it (ADR-027):
 * then only shots with code findings and every `criticEvery`-th shot of the storyboard.
 */
export function criticSampled(
  job: Pick<SceneJob, 'settings' | 'shots'>,
  shot: Pick<StoryboardShot, 'id'>,
  code: readonly QaFinding[],
): boolean {
  const every = job.settings.criticEvery;
  if (every === undefined || code.length > 0) return true;
  const index = job.shots.findIndex((candidate) => candidate.id === shot.id);
  return index < 0 || index % Math.max(1, every) === 0;
}

function early(findings: QaFinding[], source: string | undefined): QaResult {
  return { findings, verdicts: [], sheet: undefined, notes: [], source, render: undefined };
}

/** Checks the shot as it is on disk; extra checks (e.g. legibility) see the source. */
export async function qaRound(
  job: SceneJob,
  shot: StoryboardShot,
  label: string,
  extraChecks?: (source: string) => QaFinding[],
): Promise<Result<QaResult, StageError>> {
  const { ctx } = job;
  const text = await readProjectText(ctx.projectDir, shot.scene);
  if (!text.ok) return text;
  const source = text.value;
  if (source === undefined) {
    return ok(
      early([finding('scene', 'error', `${shot.scene} was not written`, { fatal: true })], source),
    );
  }
  if (source.startsWith(SCENE_STUB_MARKER)) {
    const message = `${shot.scene} is still the storyboard placeholder: write the real scene`;
    return ok(early([finding('scene', 'error', message, { fatal: true })], source));
  }
  const lint = lintFindings(lintScene(source, { filename: shot.scene }), shot.scene);
  if (lint.length > 0) return ok(early(lint, source));
  // World films (PLAN.md#13.15): an asset id nobody defines fails before any render.
  const unknownAssets = await worldAssetRefFindings(job, source, shot.scene);
  if (!unknownAssets.ok) return unknownAssets;
  if (unknownAssets.value.length > 0) return ok(early(unknownAssets.value, source));
  // Grim Ink (PLAN.md#14.19): three times per framing of the cut table; elsewhere the smoke times.
  const times = worldQaTimes({
    world: job.world,
    source,
    shot,
    anchors: job.anchorIndex,
    smoke: smokeTimes(shot.t1 - shot.t0),
  });
  // A variant (PLAN.md#11.3) is checked from its own file at the storyboard shot's place.
  const own = job.shots.find((candidate) => candidate.id === shot.id)?.scene;
  const scene = own === undefined || own === shot.scene ? undefined : shot.scene;
  const rendered = await renderShot(
    job.frames,
    {
      projectDir: ctx.projectDir,
      shotId: shot.id,
      times,
      cards: true,
      ...(scene === undefined ? {} : { scene }),
    },
    ctx.signal,
  );
  if (!rendered.ok) return rendered;
  const render = rendered.value;
  if (!render.ok && render.timedOut === true) {
    return ok({ ...early([renderTimeoutFinding(render)], source), render });
  }
  if (!render.ok) {
    const runtime = finding('runtime', 'error', `the scene fails: ${render.error}`, {
      fatal: true,
    });
    return ok({ ...early([runtime, ...consoleFindings(render.errors)], source), render });
  }
  // Embedded photos too small to read, unreadable camera interrupts (warnings: no fix turn,
  // PLAN real-run v2.3), characters and mascot that do not match the project (PLAN.md#12.20).
  const extra = [
    ...(extraChecks?.(source) ?? []),
    ...assetSizeFindings(source, shot.scene),
    ...cameraInterruptFindings(source, shot.scene, shot.interrupt),
    ...characterSourceFindings(source, shot.scene, shot, job.characters),
    // Slurs and profanity in any string (an error: the fix turn replaces the word).
    ...offensiveSourceFindings(source, shot.scene),
    // Shorts (PLAN.md#13.18): no copy of a film scene (error), a beat every 3 s (warning).
    ...shortCopyFindings(job.short, source, shot.scene),
    ...shortMotionFindings(job.short, shot, render),
  ];
  const sync = syncFindings(
    shotSyncEvents({
      shot,
      anchors: render.anchors,
      sceneCues: render.cues,
      words: job.anchorIndex,
      source,
    }),
    shot,
  );
  // Anti-slop guards (PLAN.md#13.7): warnings only; they never decide a fix turn or the sampling.
  const slop = slopShotFindings(job.antiSlop, { source, shot, frames: render.frames });
  const code = [...programmaticCritique(render), ...sync, ...extra];
  // A short's end card (PLAN.md#13.18) is the app's: never a critic turn.
  const critic: TurnRunner | undefined =
    job.settings.critic && ctx.hasClaude && !isEndCardShot(shot)
      ? (turn) => ctx.claude(turn)
      : undefined;
  if (critic === undefined || fixableFindings(code).length > 0 || !criticSampled(job, shot, code)) {
    return ok({ ...early([...code, ...slop], source), render });
  }
  const lookVars = criticLookVars(job.lookMode, shot, job.looks);
  const judged = await critiqueFrames(
    {
      projectDir: ctx.projectDir,
      shotId: shot.id,
      intent: shot.intent,
      styleId: job.styleId,
      lookVars: {
        ...lookVars,
        // Grim Ink: two authored frames of the shot's look as the bar (PLAN.md#14.19).
        ...(await criticReferenceVars(ctx.projectDir, job.world, lookVars['lookId'])),
        ...criticCharacterVars(job.characters, shot),
        // A world's checklist: the critic names the focal point and the traces (PLAN.md#13.6).
        ...criticWorldPromptVars(job.world, shot),
        // Grim Ink: what the shot's direction plan must show (PLAN.md#14.16); else nothing.
        ...criticDirectionVars(job.direction, shot),
      },
      craft: job.world !== undefined,
      minModel: criticMinModel(job.world),
      research: researchExcerpt(job.researchNotes, shotFocus(shot, job.words)),
      render,
      sheetFile: qaSheetFile(shot.id, label),
    },
    critic,
  );
  if (!judged.ok) return judged;
  return ok({
    findings: [...judged.value.findings, ...sync, ...extra, ...slop],
    verdicts: judged.value.verdicts,
    sheet: judged.value.sheet,
    notes: judged.value.notes,
    source,
    render,
  });
}
