/**
 * The code layer of the final review (PLAN.md#11.5), no Claude: per shot the determinism lint, a
 * 3-frame render with card diagnostics (blank, clipped, overlap, safe area, console errors), the
 * phone-legibility check of its text calls and its events from the sync report. The renders become
 * the rows of the contact sheets the batched critic reads.
 */
import { lintScene } from '@reelforge/engine';
import { ok, type Result } from '@reelforge/claude-bridge';
import type { QaFinding, ShotSync, StoryboardShot } from '@reelforge/shared';
import { readProjectText } from '../files.js';
import { slopShotFindings } from '../slop/guards.js';
import { SCENE_STUB_MARKER } from '../stages/scene-stub.js';
import type { StageError } from '../types.js';
import { consoleFindings, finding, lintFindings, renderTimeoutFinding } from './checks.js';
import { programmaticCritique } from './critic.js';
import type { SceneJob } from './job.js';
import { renderShot } from './render.js';
import { reviewTimes } from './review.js';
import type { SheetShot } from './sheet.js';
import { assetSizeFindings, legibilityFindings } from './source-checks.js';
import { cameraInterruptFindings } from './source-checks-camera.js';
import { syncFindings } from './sync.js';

export interface CheckedShot {
  readonly findings: readonly QaFinding[];
  /** Contact sheet row (undefined: nothing could be rendered, e.g. no scene file). */
  readonly row: SheetShot | undefined;
}

/** The phone-legibility rule of the settings at `frameWidth`. */
export function legibilityCheck(
  job: SceneJob,
  shot: StoryboardShot,
  frameWidth: number,
): (source: string) => QaFinding[] {
  return (source) =>
    legibilityFindings(source, shot.scene, {
      minScale: job.settings.minTextScale,
      minGlyphPx: job.settings.minGlyphPx,
      frameWidth,
    });
}

/** ✓ / ⚠ / ✗ of a finding list (fatal = cannot render). */
export function findingsStatus(findings: readonly QaFinding[]): 'ok' | 'warning' | 'failed' {
  if (findings.some((entry) => entry.fatal)) return 'failed';
  return findings.length > 0 ? 'warning' : 'ok';
}

export async function checkShot(
  job: SceneJob,
  shot: StoryboardShot,
  sync: ShotSync | undefined,
): Promise<Result<CheckedShot, StageError>> {
  const { ctx } = job;
  const text = await readProjectText(ctx.projectDir, shot.scene);
  if (!text.ok) return text;
  const source = text.value;
  if (source === undefined || source.startsWith(SCENE_STUB_MARKER)) {
    const message =
      source === undefined
        ? `${shot.scene} does not exist`
        : `${shot.scene} is still the storyboard placeholder`;
    return ok({ findings: [finding('scene', 'error', message, { fatal: true })], row: undefined });
  }
  const lint = lintFindings(lintScene(source, { filename: shot.scene }), shot.scene);
  const times = reviewTimes(shot.t1 - shot.t0);
  const rendered = await renderShot(
    job.frames,
    { projectDir: ctx.projectDir, shotId: shot.id, times, cards: true },
    ctx.signal,
  );
  if (!rendered.ok) return rendered;
  const render = rendered.value;
  const row: SheetShot = { shotId: shot.id, times, render };
  if (!render.ok && render.timedOut === true) {
    return ok({ findings: [...lint, renderTimeoutFinding(render.error)], row });
  }
  if (!render.ok) {
    const failure = finding('runtime', 'error', `the scene fails: ${render.error}`, {
      fatal: true,
    });
    return ok({ findings: [...lint, failure, ...consoleFindings(render.errors)], row });
  }
  return ok({
    findings: [
      ...lint,
      ...programmaticCritique(render),
      ...legibilityCheck(job, shot, render.width)(source),
      ...assetSizeFindings(source, shot.scene),
      ...cameraInterruptFindings(source, shot.scene, shot.interrupt),
      ...(sync === undefined ? [] : syncFindings(sync.events, shot)),
      // Anti-slop guards (PLAN.md#13.7): ⚠ only, never a fix turn (needFinalFix sees errors).
      ...slopShotFindings(job.antiSlop, { source, shot, frames: render.frames }),
    ],
    row,
  });
}
