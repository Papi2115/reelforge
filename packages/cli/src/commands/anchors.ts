/**
 * `reelforge anchors`: resolves spoken phrases (pipeline AnchorIndex) and, per shot, lists the
 * anchors and sfx cues the scene declares in build() (a build-only dry run in the engine) with
 * the ±150 ms landing check.
 */
import { pickShotOccurrence, type AnchorWindow } from '@reelforge/engine';
import { AnchorIndex } from '@reelforge/pipeline';
import { COMMON_OPTIONS, parseCommandArgs, parseInteger } from '../args.js';
import { result, type Command } from '../command.js';
import { ProjectError } from '../errors.js';
import { indent, plural, seconds, timeRange, verdictLine } from '../format.js';
import { readProjectFiles, type ProjectFiles } from '../project/files.js';
import { PROJECT_PATHS } from '../project/paths.js';
import { allShotPlans, planForShot, renderSetup } from '../project/shots.js';
import { renderShots, shotIssues, type ShotOutcome } from '../render/run.js';
import {
  checkAnchors,
  checkCues,
  countSyncProblems,
  formatAnchorCheck,
  formatCueCheck,
  LANDING_TOLERANCE_S,
} from './anchors-check.js';

export const ANCHORS_USAGE = `usage: reelforge anchors [--shot <id>] [--phrase "<spoken words>" [--nth <n>]] [--json]
With --phrase: where the phrase is spoken (fuzzy match over timing/words.json), all occurrences
and the shot it falls in; with --shot too, the occurrence spoken in that shot (as ctx.anchor
resolves it: --nth counts from the shot's start when the film-wide one is outside the shot). Without: builds each scene (no rendering) and lists the anchors it
resolves and the sfx cues it schedules, checking that cues land within ±${String(LANDING_TOLERANCE_S * 1000)} ms of an anchor
and that anchors are spoken inside their shot.
  --shot <id>        only this shot
  --phrase <text>    resolve a phrase (repeatable)
  --nth <n>          which occurrence of the phrase (default 1)
Exit code: 0 ok, 1 problems (phrase not found, scene failed, cue misses its anchor, anchor
outside its shot), 2 usage error.`;

const OPTIONS = {
  ...COMMON_OPTIONS,
  shot: { type: 'string' },
  phrase: { type: 'string', multiple: true },
  nth: { type: 'string' },
} as const;

function anchorIndex(files: ProjectFiles): AnchorIndex | undefined {
  if (files.words.status !== 'ok') return undefined;
  const lang = files.project.status === 'ok' ? files.project.data.language : files.words.data.lang;
  return new AnchorIndex(files.words.data.words, { lang });
}

function requireIndex(files: ProjectFiles): AnchorIndex {
  const index = anchorIndex(files);
  if (index) return index;
  throw new ProjectError(
    `${PROJECT_PATHS.words} is ${files.words.status === 'missing' ? 'missing' : 'invalid'}`,
    files.words.status === 'missing'
      ? 'anchors need timed words: the "Words timed" stage has not run yet'
      : 'run reelforge validate and fix timing/words.json',
  );
}

function shotAt(files: ProjectFiles, t: number): string | undefined {
  if (files.storyboard.status !== 'ok') return undefined;
  return files.storyboard.data.shots.find((shot) => t >= shot.t0 && t < shot.t1)?.id;
}

/** The storyboard range of `--shot` (anchors in a shot mean the occurrence spoken in it). */
function shotWindow(files: ProjectFiles, shotId: string | undefined): AnchorWindow | undefined {
  if (shotId === undefined) return undefined;
  const shot =
    files.storyboard.status === 'ok'
      ? files.storyboard.data.shots.find((candidate) => candidate.id === shotId)
      : undefined;
  if (shot === undefined) {
    throw new ProjectError(
      `no shot ${shotId} in ${PROJECT_PATHS.storyboard}`,
      'pass a shot id from storyboard.json, or leave --shot out to resolve over the whole film',
    );
  }
  return { t0: shot.t0, t1: shot.t1 };
}

/** The film-wide `nth` occurrence, or with a shot the one spoken in it (pickShotOccurrence). */
function resolveIn(
  index: AnchorIndex,
  phrase: string,
  nth: number,
  window: AnchorWindow | undefined,
): ReturnType<AnchorIndex['resolve']> {
  const resolved = index.resolve(phrase, nth);
  if (window === undefined || !resolved.ok) return resolved;
  const picked = pickShotOccurrence(index.occurrences(phrase), nth, window);
  return picked === undefined ? resolved : { ok: true, value: picked };
}

function resolvePhrases(
  files: ProjectFiles,
  phrases: readonly string[],
  nth: number,
  shotId?: string,
): { lines: string[]; json: unknown[]; problems: number } {
  const index = requireIndex(files);
  const window = shotWindow(files, shotId);
  const lines: string[] = [];
  const json: unknown[] = [];
  let problems = 0;
  for (const phrase of phrases) {
    const resolved = resolveIn(index, phrase, nth, window);
    if (!resolved.ok) {
      problems += 1;
      lines.push(
        `NOT FOUND "${phrase}"${nth > 1 ? ` #${String(nth)}` : ''}: ${resolved.error.message}`,
      );
      json.push({ phrase, nth, ok: false, error: resolved.error });
      continue;
    }
    const match = resolved.value;
    const occurrences = index.occurrences(phrase);
    const shot = shotAt(files, match.t);
    lines.push(
      `ok "${phrase}"${nth > 1 ? ` #${String(nth)}` : ''} -> ${timeRange(match.t, match.tEnd)} "${match.text}" (similarity ${match.similarity.toFixed(2)})${shot ? ` in shot ${shot}` : ''}`,
      `   spoken ${plural(occurrences.length, 'time')}: ${occurrences.map((occurrence) => seconds(occurrence.t)).join(', ')}`,
    );
    json.push({
      phrase,
      nth,
      ok: true,
      match,
      shot: shot ?? null,
      occurrences: occurrences.map((occurrence) => occurrence.t),
    });
  }
  return { lines, json, problems };
}

/** Suggestions for an `anchor-not-found` engine error, from the fuzzy resolver. */
function missingAnchorHint(message: string, index: AnchorIndex | undefined): string | undefined {
  const match = /anchor\("(.*)", (\d+)\) is not spoken/.exec(message);
  if (!match || !index) return undefined;
  const resolved = index.resolve(match[1] ?? '', Number(match[2] ?? '1'));
  return resolved.ok
    ? `the fuzzy resolver finds it at ${seconds(resolved.value.t)} ("${resolved.value.text}"); copy that exact wording into anchor()`
    : resolved.error.message;
}

function shotReport(
  outcome: ShotOutcome,
  index: AnchorIndex | undefined,
): { lines: string[]; json: unknown; problems: number } {
  const { plan, render } = outcome;
  const lines = [`shot ${plan.id} · ${plan.file} · global ${timeRange(plan.t0, plan.t1)}`];
  if (!render?.ok) {
    const issues = shotIssues(outcome);
    for (const issue of issues) {
      lines.push(
        indent(`${issue.kind === 'load' ? 'scene failed to build' : issue.kind}: ${issue.message}`),
      );
      const hint = issue.kind === 'load' ? missingAnchorHint(issue.message, index) : undefined;
      if (hint) lines.push(indent(`hint: ${hint}`));
    }
    return {
      lines,
      json: { id: plan.id, file: plan.file, ok: false, issues },
      problems: Math.max(1, issues.length),
    };
  }
  const anchors = checkAnchors(plan, render.anchors, render.cues, index);
  const cues = checkCues(plan, render.cues, render.anchors);
  lines.push(
    anchors.length === 0 ? '  anchors: none (build() calls no ctx.anchor)' : '  anchors:',
    ...anchors.map((check) => indent(formatAnchorCheck(check, plan), '    ')),
    cues.length === 0 ? '  sfx cues: none' : '  sfx cues:',
    ...cues.map((check) => indent(formatCueCheck(check, plan), '    ')),
  );
  const problems = countSyncProblems(anchors, cues) + render.errors.length;
  lines.push(...render.errors.map((error) => indent(`console error: ${error}`)));
  return {
    lines,
    json: {
      id: plan.id,
      file: plan.file,
      t0: plan.t0,
      t1: plan.t1,
      ok: true,
      anchors,
      cues,
      errors: render.errors,
    },
    problems,
  };
}

export const anchorsCommand: Command = {
  name: 'anchors',
  summary: 'resolve spoken phrases; list scene anchors/sfx cues with the ±150 ms landing check',
  usage: ANCHORS_USAGE,
  async run(argv, context) {
    const { values } = parseCommandArgs(argv, OPTIONS, false);
    const nth = values.nth === undefined ? 1 : parseInteger(values.nth, '--nth', 1, 1000);
    const files = await readProjectFiles(context.root);
    if (values.phrase !== undefined) {
      const resolved = resolvePhrases(files, values.phrase, nth, values.shot);
      resolved.lines.push(
        verdictLine(
          resolved.problems,
          'use a phrase copied from the script (see the closest matches)',
        ),
      );
      return result(resolved.problems, resolved.lines, { phrases: resolved.json });
    }
    const setup = renderSetup(files);
    const plans =
      values.shot === undefined
        ? await allShotPlans(files)
        : [await planForShot(files, values.shot)];
    const outcomes = await renderShots(
      setup,
      plans.map((plan) => ({ plan, times: [] })),
      { cards: false },
    );
    const index = anchorIndex(files);
    const reports = outcomes.map((outcome) => shotReport(outcome, index));
    const problems = reports.reduce((sum, report) => sum + report.problems, 0);
    const lines = reports.flatMap((report) => report.lines);
    lines.push(
      verdictLine(problems, 'fix the MISS/OUTSIDE lines (times are global unless marked local)'),
    );
    return result(problems, lines, { shots: reports.map((report) => report.json), problems });
  },
};
