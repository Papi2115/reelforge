/** `reelforge contact-sheet`: one labelled PNG grid (a row of frames per shot) for visual review. */
import { findStylePreset } from '@reelforge/engine';
import { COMMON_OPTIONS, parseCommandArgs, parseInteger } from '../args.js';
import { result, type Command } from '../command.js';
import { UsageError } from '../errors.js';
import { indent, plural, seconds, timeRange, verdictLine } from '../format.js';
import { readProjectFiles } from '../project/files.js';
import {
  allShotPlans,
  planForShot,
  renderSetup,
  requireProject,
  type RenderSetup,
} from '../project/shots.js';
import { framesDir, writePng } from '../render/output.js';
import {
  renderShots,
  shotIssues,
  spreadTimes,
  type ShotIssue,
  type ShotOutcome,
} from '../render/run.js';
import { composeSheet, type SheetRow } from '../render/sheet.js';

export const CONTACT_SHEET_USAGE = `usage: reelforge contact-sheet [--shot <id>[,<id>...] | --all] [--per-shot <n>] [--json]
Renders <n> frames per shot (spread over the shot) and writes ONE labelled grid image: a row per
shot, each tile labelled "<shot> <local time>". Prints its path (Read it) and the QA problems.
  --shot <ids>       only these shots (comma-separated); default --all
  --all              every storyboard shot (default)
Tiles are half size unless the sheet is one shot with at most 2 frames.
  --per-shot <n>     frames per shot, 1-8 (default 3)
Exit code: 0 ok, 1 problems (a shot failed, blank frames, card problems, console errors),
2 usage error.`;

const OPTIONS = {
  ...COMMON_OPTIONS,
  shot: { type: 'string' },
  all: { type: 'boolean', default: false },
  'per-shot': { type: 'string' },
} as const;

const DEFAULT_PER_SHOT = 3;
const MAX_PER_SHOT = 8;
const FALLBACK_SIZE = { width: 640, height: 360 };

function frameSize(
  outcomes: readonly ShotOutcome[],
  setup: RenderSetup,
): { width: number; height: number } {
  for (const outcome of outcomes) {
    if (outcome.render?.ok) return { width: outcome.render.width, height: outcome.render.height };
  }
  return findStylePreset(setup.style)?.resolution ?? FALLBACK_SIZE;
}

function failureLabel(issues: readonly ShotIssue[]): string {
  return issues.some((issue) => issue.kind === 'lint') ? 'LINT ERRORS' : 'FAILED TO LOAD';
}

export function sheetRows(
  outcomes: readonly ShotOutcome[],
  times: (outcome: ShotOutcome) => readonly number[],
): SheetRow[] {
  return outcomes.map((outcome) => {
    const render = outcome.render;
    if (render?.ok) {
      return {
        tiles: render.frames.map((frame) => ({
          label: `${outcome.plan.id} ${seconds(frame.t)}`,
          frame: frame.image,
        })),
      };
    }
    const failure = failureLabel(shotIssues(outcome));
    return {
      tiles: times(outcome).map((t) => ({ label: `${outcome.plan.id} ${seconds(t)}`, failure })),
    };
  });
}

export const contactSheetCommand: Command = {
  name: 'contact-sheet',
  summary: 'one labelled grid image of frames per shot (for visual review)',
  usage: CONTACT_SHEET_USAGE,
  async run(argv, context) {
    const { values } = parseCommandArgs(argv, OPTIONS, false);
    if (values.all && values.shot !== undefined)
      throw new UsageError('pass either --shot or --all, not both');
    const perShot = parseInteger(
      values['per-shot'] ?? String(DEFAULT_PER_SHOT),
      '--per-shot',
      1,
      MAX_PER_SHOT,
    );
    const files = await readProjectFiles(context.root);
    const project = requireProject(files);
    const setup = renderSetup(files);
    const ids = values.shot
      ?.split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '');
    const plans = ids
      ? await Promise.all(ids.map((id) => planForShot(files, id)))
      : await allShotPlans(files);
    const timesOf = new Map(plans.map((plan) => [plan.id, spreadTimes(plan, perShot)]));
    const outcomes = await renderShots(
      setup,
      plans.map((plan) => ({ plan, times: timesOf.get(plan.id) ?? [] })),
      { cards: true },
    );
    const size = frameSize(outcomes, setup);
    const sheet = composeSheet(
      {
        title: `${project.title} - ${plural(plans.length, 'shot')} x ${String(perShot)} - t = local shot time`,
        frameWidth: size.width,
        frameHeight: size.height,
        factor: plans.length > 1 || perShot > 2 ? 2 : 1,
      },
      sheetRows(outcomes, (outcome) => timesOf.get(outcome.plan.id) ?? []),
    );
    const only = plans.length === 1 ? plans[0] : undefined;
    const file = await writePng(
      only
        ? framesDir(context.root, only.id, 'contact-sheet.png')
        : framesDir(context.root, 'contact-sheet.png'),
      sheet,
    );
    const shots = outcomes.map((outcome) => ({
      id: outcome.plan.id,
      file: outcome.plan.file,
      t0: outcome.plan.t0,
      t1: outcome.plan.t1,
      times: timesOf.get(outcome.plan.id) ?? [],
      issues: shotIssues(outcome),
    }));
    const problems = shots.flatMap((shot) =>
      shot.issues.map((issue) => ({ shot: shot.id, ...issue })),
    );
    const lines = [
      `contact sheet: ${file}`,
      'rows (one per shot; tiles at local shot times):',
      ...shots.map(
        (shot) =>
          `  ${shot.id.padEnd(8)} ${shot.file}  global ${timeRange(shot.t0, shot.t1)}  tiles at ${shot.times.map(seconds).join(', ')}${shot.issues.length ? `  (${plural(shot.issues.length, 'problem')})` : ''}`,
      ),
    ];
    if (problems.length > 0) {
      lines.push(
        'problems:',
        ...problems.map((problem) =>
          indent(`[${problem.shot}] ${problem.kind}: ${problem.message}`),
        ),
      );
    }
    lines.push(
      verdictLine(
        problems.length,
        'run reelforge frames --shot <id> for details, fix, and check again',
      ),
    );
    return result(problems.length, lines, { file, shots, problems });
  },
};
