/**
 * `reelforge render-shot <id>`: a low-res preview of a shot's motion: frames at a fixed step
 * written as PNGs plus one strip image (rows of frames in time order) to Read.
 */
import { COMMON_OPTIONS, parseCommandArgs, parsePositiveSeconds, parseTimes } from '../args.js';
import { result, type Command } from '../command.js';
import { UsageError } from '../errors.js';
import { seconds, verdictLine } from '../format.js';
import { readProjectFiles } from '../project/files.js';
import { planForShot, renderSetup, type ShotPlan } from '../project/shots.js';
import { frameFileName, framesDir, writePng } from '../render/output.js';
import {
  assertTimesInShot,
  formatQa,
  lastFrameTime,
  renderShots,
  shotDuration,
  shotIssues,
} from '../render/run.js';
import { composeSheet, type SheetRow } from '../render/sheet.js';
import { shotHeader } from './frames.js';

export const RENDER_SHOT_USAGE = `usage: reelforge render-shot <id> [--step <s> | --at <t,t,...>] [--json]
Renders a shot's motion as frames every <step> seconds (local shot time) into
.reelforge/frames/<id>/clip/ and one strip image .reelforge/frames/<id>/clip.png (half size,
4 frames per row, labelled with the local time). Read the strip to judge timing and motion.
  --step <s>         seconds between frames (default: shot length / 12, at least 1/fps)
  --at <list>        explicit local shot times instead of --step (max 24)
Exit code: 0 ok, 1 problems (scene failed, blank frames, card problems, console errors),
2 usage error.`;

const OPTIONS = {
  ...COMMON_OPTIONS,
  step: { type: 'string' },
  at: { type: 'string' },
} as const;

const DEFAULT_FRAME_COUNT = 12;
const MAX_FRAMES = 24;
const STRIP_COLUMNS = 4;

export function stepTimes(plan: ShotPlan, fps: number, step?: number): number[] {
  const last = lastFrameTime(plan, fps);
  const interval = Math.max(1 / fps, step ?? shotDuration(plan) / DEFAULT_FRAME_COUNT);
  const count = Math.min(MAX_FRAMES, Math.floor(last / interval + 1e-9) + 1);
  return Array.from({ length: count }, (_, index) => Math.round(index * interval * 100) / 100);
}

export const renderShotCommand: Command = {
  name: 'render-shot',
  summary: 'low-res motion preview of one shot (frames + one strip image)',
  usage: RENDER_SHOT_USAGE,
  async run(argv, context) {
    const { values, positionals } = parseCommandArgs(argv, OPTIONS, true);
    const [id, ...extra] = positionals;
    if (id === undefined || extra.length > 0)
      throw new UsageError('pass exactly one shot id, e.g. reelforge render-shot s03');
    if (values.step !== undefined && values.at !== undefined)
      throw new UsageError('pass either --step or --at, not both');
    const files = await readProjectFiles(context.root);
    const setup = renderSetup(files);
    const plan = await planForShot(files, id);
    const times =
      values.at !== undefined
        ? parseTimes(values.at)
        : stepTimes(
            plan,
            setup.fps,
            values.step === undefined ? undefined : parsePositiveSeconds(values.step, '--step'),
          );
    if (times.length > MAX_FRAMES)
      throw new UsageError(`--at: at most ${String(MAX_FRAMES)} times`);
    assertTimesInShot(plan, times, setup.fps);
    const [outcome] = await renderShots(setup, [{ plan, times }], { cards: true });
    if (!outcome) throw new Error('renderShots returned no outcome');
    const issues = shotIssues(outcome);
    const lines = [shotHeader(outcome)];
    let strip: string | null = null;
    const frames: string[] = [];
    if (outcome.render?.ok) {
      const render = outcome.render;
      for (const frame of render.frames) {
        frames.push(
          await writePng(
            framesDir(context.root, plan.id, 'clip', frameFileName(plan.id, frame.t)),
            frame.image,
          ),
        );
      }
      const rows: SheetRow[] = [];
      for (let start = 0; start < render.frames.length; start += STRIP_COLUMNS) {
        rows.push({
          tiles: render.frames
            .slice(start, start + STRIP_COLUMNS)
            .map((frame) => ({ label: `${plan.id} ${seconds(frame.t)}`, frame: frame.image })),
        });
      }
      const sheet = composeSheet(
        {
          title: `${plan.id} motion - ${String(render.frames.length)} frames - t = local shot time`,
          frameWidth: render.width,
          frameHeight: render.height,
          factor: 2,
        },
        rows,
      );
      strip = await writePng(framesDir(context.root, plan.id, 'clip.png'), sheet);
      lines.push(
        `strip: ${strip}`,
        `frames: ${String(frames.length)} PNGs at ${times.map(seconds).join(', ')} in ${framesDir(context.root, plan.id, 'clip')}`,
      );
    }
    lines.push(
      formatQa(outcome, issues),
      verdictLine(issues.length, 'fix the scene and run reelforge render-shot again'),
    );
    return result(issues.length, lines, {
      shot: { id: plan.id, file: plan.file, t0: plan.t0, t1: plan.t1 },
      strip,
      frames,
      times,
      issues,
    });
  },
};
