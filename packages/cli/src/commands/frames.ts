/** `reelforge frames`: renders PNG frames of one shot plus text-card QA and console errors. */
import { COMMON_OPTIONS, parsePositiveSeconds, parseCommandArgs, parseTimes } from '../args.js';
import { result, type Command } from '../command.js';
import { UsageError } from '../errors.js';
import { seconds, timeRange, verdictLine } from '../format.js';
import { readProjectFiles } from '../project/files.js';
import { planForScene, planForShot, renderSetup, type ShotPlan } from '../project/shots.js';
import { frameFileName, framesDir, writePng } from '../render/output.js';
import {
  assertTimesInShot,
  formatQa,
  lastFrameTime,
  renderShots,
  shotDuration,
  shotIssues,
  type ShotOutcome,
} from '../render/run.js';
import { blankFrameNote } from '../render/session.js';

export const FRAMES_USAGE = `usage: reelforge frames (--shot <id> | --scene <scenes/file.js>) [--at <t,t,...>] [--json]
Renders frames of one shot through the engine (same renderer as preview and export) into
.reelforge/frames/<shot>/ and prints their paths (Read them to look at the frames), followed by
text-card QA (overlaps, safe area) and console errors.
  --shot <id>        storyboard shot id
  --scene <file>     scene module; its storyboard shot is used, or it renders standalone from
                     t=0 when no shot uses it yet. With --shot: render that shot with this file
  --at <list>        local shot times in seconds (0 = shot start), default 5 points over the shot
  --duration <s>     length of a standalone scene (default max(5, last --at + 1))
Exit code: 0 ok, 1 problems (lint errors, scene failed, blank frames, card problems, console
errors), 2 usage error.`;

const OPTIONS = {
  ...COMMON_OPTIONS,
  shot: { type: 'string' },
  scene: { type: 'string' },
  at: { type: 'string' },
  duration: { type: 'string' },
} as const;

const DEFAULT_POINTS = [0, 0.25, 0.5, 0.75] as const;

export interface WrittenFrame {
  /** Local shot time. */
  readonly t: number;
  readonly globalT: number;
  /** Absolute path of the PNG. */
  readonly file: string;
  /** Why the frame looks blank, or null. */
  readonly blank: string | null;
}

export function defaultFrameTimes(plan: ShotPlan, fps: number): number[] {
  const duration = shotDuration(plan);
  const spread = DEFAULT_POINTS.map((share) => Math.round(share * duration * 100) / 100);
  return [...new Set([...spread, lastFrameTime(plan, fps)])].sort((a, b) => a - b);
}

/** `shot s01 · scenes/s01.js · global 0.00–4.20s (4.20s) · 640x360 voxel-pixel-crisp640` */
export function shotHeader(outcome: ShotOutcome): string {
  const { plan, render } = outcome;
  const size = render?.ok
    ? ` · ${String(render.width)}x${String(render.height)} ${render.style}`
    : '';
  const header = `shot ${plan.id} · ${plan.file} · global ${timeRange(plan.t0, plan.t1)} (${seconds(shotDuration(plan))})${size}`;
  return plan.standalone
    ? `${header}\nnote: no storyboard shot uses this scene; rendered standalone from t=0 (anchors resolve to their global spoken times)`
    : header;
}

async function resolvePlan(
  values: { shot?: string | undefined; scene?: string | undefined; duration?: string | undefined },
  files: Awaited<ReturnType<typeof readProjectFiles>>,
  times: readonly number[] | undefined,
): Promise<ShotPlan> {
  if (values.shot !== undefined) return planForShot(files, values.shot, values.scene);
  if (values.scene === undefined)
    throw new UsageError('pass --shot <id> or --scene <scenes/file.js>');
  const fixed =
    values.duration === undefined ? undefined : parsePositiveSeconds(values.duration, '--duration');
  return planForScene(
    files,
    values.scene,
    (minimum) => fixed ?? Math.max(minimum, Math.max(0, ...(times ?? [])) + 1),
  );
}

export const framesCommand: Command = {
  name: 'frames',
  summary: 'render PNG frames of a shot + text-card QA + console errors',
  usage: FRAMES_USAGE,
  async run(argv, context) {
    const { values } = parseCommandArgs(argv, OPTIONS, false);
    const requested = values.at === undefined ? undefined : parseTimes(values.at);
    const files = await readProjectFiles(context.root);
    const setup = renderSetup(files);
    const plan = await resolvePlan(values, files, requested);
    const times = requested ?? defaultFrameTimes(plan, setup.fps);
    assertTimesInShot(plan, times, setup.fps);
    const [outcome] = await renderShots(setup, [{ plan, times }], { cards: true });
    if (!outcome) throw new Error('renderShots returned no outcome');
    const frames: WrittenFrame[] = [];
    if (outcome.render?.ok) {
      for (const frame of outcome.render.frames) {
        const file = await writePng(
          framesDir(context.root, plan.id, frameFileName(plan.id, frame.t)),
          frame.image,
        );
        frames.push({
          t: frame.t,
          globalT: plan.t0 + frame.t,
          file,
          blank: blankFrameNote(frame.stats) ?? null,
        });
      }
    }
    const issues = shotIssues(outcome);
    const lines = [shotHeader(outcome)];
    if (frames.length > 0) {
      lines.push(
        'frames (t = local shot time; Read these PNG files):',
        ...frames.map(
          (frame) =>
            `  t=${seconds(frame.t).padEnd(7)} ${frame.file}${frame.blank ? `  ! ${frame.blank}` : ''}`,
        ),
      );
    }
    lines.push(
      formatQa(outcome, issues),
      verdictLine(issues.length, 'fix the scene and run reelforge frames again'),
    );
    return result(issues.length, lines, {
      shot: { id: plan.id, file: plan.file, t0: plan.t0, t1: plan.t1, standalone: plan.standalone },
      frames,
      issues,
      lint: outcome.lint,
    });
  },
};
