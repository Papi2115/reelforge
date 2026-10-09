/**
 * Script of a SHORT (PLAN.md#13.18): no research turn; the film's research.md is copied in (so
 * the claims check, the critic and the guards read the same facts as the film's) and the
 * `short-script` turn writes `script.txt` (a retention teaser within its word budget) and
 * `hooks.md` (three candidate hooks, the chosen one first in the script) from the film's script,
 * beats and research. Both are validated with one repair turn; an invalid script fails the stage.
 */
import path from 'node:path';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import {
  shortScriptPromptVars,
  validateResearch,
  validateShortHooks,
  validateShortScript,
  type ShortScriptStats,
} from '@reelforge/prompts';
import {
  SCRIPT_REPORT_VERSION,
  SHORT_WORDS_PER_SECOND,
  scriptReportSchema,
  type BriefFile,
  type ProjectFile,
  type ShortSettings,
} from '@reelforge/shared';
import { readProjectText, writeProjectJson, writeProjectText } from '../files.js';
import { FILES, REPORTS } from '../paths.js';
import {
  checkWithRepair,
  errorLines,
  render,
  warningLines,
  type OutputCheck,
} from '../stages/repair.js';
import { stageError, type StageContext, type StageError, type StageSummary } from '../types.js';
import { activeWorld, scriptWorldPromptVars, worldScope } from '../worlds.js';

export const SHORT_HOOKS_FILE = 'hooks.md';

type ShortProject = ProjectFile & {
  readonly kind: 'short';
  readonly short: ShortSettings;
};

/** The channel name of the end card (`Full video on YT: <name>`). */
export function endCardChannelName(endCardText: string): string {
  const name = endCardText.replace(/^Full video on YT:\s*/i, '').trim();
  return name === '' ? endCardText : name;
}

/** The film's folder of a short (relative folders resolve against the short's own). */
export function parentFolder(projectDir: string, project: ProjectFile): string | undefined {
  const folder = project.parentProject?.folder;
  return folder === undefined ? undefined : path.resolve(projectDir, folder);
}

interface FilmTexts {
  readonly script: string;
  readonly beats: string | undefined;
  readonly research: string | undefined;
}

async function readFilm(filmDir: string): Promise<Result<FilmTexts, StageError>> {
  const [script, beats, research] = await Promise.all([
    readProjectText(filmDir, FILES.script),
    readProjectText(filmDir, FILES.beats),
    readProjectText(filmDir, FILES.research),
  ]);
  if (!script.ok) return script;
  if (script.value === undefined || script.value.trim() === '') {
    return err(stageError('not-ready', `the film has no script yet (${filmDir})`));
  }
  return ok({
    script: script.value,
    beats: beats.ok ? beats.value : undefined,
    research: research.ok ? research.value : undefined,
  });
}

async function checkShortOutputs(
  ctx: StageContext,
  lengthS: ShortSettings['lengthS'],
): Promise<OutputCheck<ShortScriptStats>> {
  const [script, hooks] = await Promise.all([
    readProjectText(ctx.projectDir, FILES.script),
    readProjectText(ctx.projectDir, SHORT_HOOKS_FILE),
  ]);
  if (!script.ok) return { value: undefined, problems: [script.error.message], warnings: [] };
  if (script.value === undefined) {
    return { value: undefined, problems: [`${FILES.script} was not written`], warnings: [] };
  }
  const report = validateShortScript(script.value, { lengthS });
  const problems = errorLines(report.issues);
  const warnings = warningLines(report.issues);
  if (!hooks.ok) problems.push(hooks.error.message);
  else if (hooks.value === undefined) problems.push(`${SHORT_HOOKS_FILE} was not written`);
  else {
    const hookReport = validateShortHooks(hooks.value, { script: script.value });
    problems.push(...errorLines(hookReport.issues).map((line) => `${SHORT_HOOKS_FILE}: ${line}`));
    warnings.push(...warningLines(hookReport.issues).map((line) => `${SHORT_HOOKS_FILE}: ${line}`));
  }
  return { value: report.value, problems, warnings };
}

/** The Script stage of a short project. */
export async function runShortScript(
  ctx: StageContext,
  project: ShortProject,
  brief: BriefFile,
): Promise<Result<StageSummary, StageError>> {
  const filmDir = parentFolder(ctx.projectDir, project);
  if (filmDir === undefined) {
    return err(stageError('not-ready', 'project.json of the short names no parent film'));
  }
  const film = await readFilm(filmDir);
  if (!film.ok) return film;
  ctx.step('Copying the film research', 5);
  if (film.value.research !== undefined) {
    const copied = await writeProjectText(ctx.projectDir, FILES.research, film.value.research);
    if (!copied.ok) return copied;
  }
  const { lengthS } = project.short;
  const prompt = render('short-script', {
    ...shortScriptPromptVars({
      parentTitle: project.parentProject?.title ?? project.title,
      parentScript: film.value.script,
      parentBeats: film.value.beats,
      research: film.value.research,
      channelName: endCardChannelName(project.short.endCardText),
      lengthS,
      language: brief.language,
      angle: project.short.angle,
      notes: brief.notes,
    }),
    ...scriptWorldPromptVars(activeWorld(project.style, worldScope(ctx.settings))),
  });
  if (!prompt.ok) return prompt;
  ctx.step('Teaser script and hooks', 30);
  const turn = await ctx.claude({
    prompt: 'short-script',
    text: prompt.value,
    purpose: 'script',
    newSession: true,
    label: 'short script',
  });
  if (!turn.ok) return turn;
  const checked = await checkWithRepair({
    ctx,
    prompt: 'short-script',
    purpose: 'script',
    file: FILES.script,
    label: 'short script',
    check: () => checkShortOutputs(ctx, lengthS),
  });
  if (!checked.ok) return checked;
  const { value: stats, problems, repairs, warnings } = checked.value;
  if (problems.length > 0 || stats === undefined) {
    return err(
      stageError(
        'validation',
        `the short's script is still invalid after a repair: ${problems.join('; ')}`,
        problems,
      ),
    );
  }
  const estimatedSeconds = Math.round((stats.wordCount / SHORT_WORDS_PER_SECOND) * 10) / 10;
  const researchSources =
    film.value.research === undefined
      ? 0
      : (validateResearch(film.value.research).value?.sources ?? 0);
  const report = await writeProjectJson(ctx.projectDir, REPORTS.script, scriptReportSchema, {
    version: SCRIPT_REPORT_VERSION,
    wordCount: stats.wordCount,
    targetWords: stats.targetWords,
    estimatedSeconds,
    repairs,
    researchSources,
    issues: [...warnings],
  });
  if (!report.ok) return report;
  return ok({
    message: `${String(stats.wordCount)} words, about ${String(Math.round(estimatedSeconds))} s of narration for the ${String(lengthS)} s short`,
    outputs: [FILES.research, FILES.script, SHORT_HOOKS_FILE],
    changed: true,
    warnings: [...warnings],
    metrics: {
      wordCount: stats.wordCount,
      targetWords: stats.targetWords,
      estimatedSeconds,
      researchSources,
      repairs,
      lengthS,
    },
  });
}
