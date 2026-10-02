/**
 * Sound cues (PLAN.md#8.1): Claude (sound-cues prompt) writes `cues.json`, validated against the
 * pipeline's `CuesFileSchema` and the prompt's mixing rules with one repair turn. In Economy mode,
 * without Claude, when Claude cannot run, or when its cues stay invalid, the deterministic
 * `generateDefaultCues` writes the file instead (reported as a warning).
 */
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { CuesFileSchema, type CuesFile } from '@reelforge/pipeline';
import { validateCues } from '@reelforge/prompts';
import { storyboardFileSchema, wordsFileSchema } from '@reelforge/shared';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { FILES, inProject } from '../paths.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type StageError,
  type StageSummary,
} from '../types.js';
import { defaultDurationS, generateDefaultCues, type DefaultCuesInput } from './default-cues.js';
import { checkWithRepair, errorLines, render, warningLines, type OutputCheck } from './repair.js';

const MUSIC_EXTENSIONS = /\.(?:wav|mp3|m4a|ogg|flac)$/i;
/** Claude failures that make the default cues take over (anything else stops the stage). */
const FALLBACK_KINDS = new Set<StageError['kind']>(['blocked', 'claude', 'missing-tool']);

async function musicFiles(projectDir: string): Promise<string[]> {
  try {
    const names = await readdir(inProject(projectDir, FILES.musicDir));
    return names
      .filter((name) => MUSIC_EXTENSIONS.test(name))
      .sort()
      .map((name) => `${FILES.musicDir}/${name}`);
  } catch {
    return []; // no audio/music folder
  }
}

async function checkCuesFile(ctx: StageContext, durationS: number): Promise<OutputCheck<CuesFile>> {
  const text = await readProjectText(ctx.projectDir, FILES.cues);
  if (!text.ok) return { value: undefined, problems: [text.error.message], warnings: [] };
  if (text.value === undefined) {
    return { value: undefined, problems: [`${FILES.cues} was not written`], warnings: [] };
  }
  const report = validateCues(text.value, {
    schema: CuesFileSchema,
    durationS,
    musicFileExists: (file) => existsSync(inProject(ctx.projectDir, file)),
  });
  return {
    value: report.value,
    problems: errorLines(report.issues),
    warnings: warningLines(report.issues),
  };
}

interface Produced {
  readonly cues: CuesFile;
  readonly source: 'claude' | 'default';
  readonly warnings: readonly string[];
}

/** Claude's cues, or (a string) the reason to fall back to the default cues. */
async function claudeCues(
  ctx: StageContext,
  styleId: string,
  durationS: number,
): Promise<Result<Produced | string, StageError>> {
  const prompt = render('sound-cues', { styleId });
  if (!prompt.ok) return prompt;
  ctx.step('Claude: sound design', 10);
  const turn = await ctx.claude({
    prompt: 'sound-cues',
    text: prompt.value,
    purpose: 'main',
    newSession: false,
    label: 'sound cues',
  });
  if (!turn.ok) {
    return FALLBACK_KINDS.has(turn.error.kind)
      ? ok(`Claude could not write the cues (${turn.error.message}); using the default cues`)
      : turn;
  }
  const checked = await checkWithRepair({
    ctx,
    prompt: 'sound-cues',
    purpose: 'main',
    file: FILES.cues,
    label: 'sound cues',
    check: () => checkCuesFile(ctx, durationS),
  });
  if (!checked.ok) return checked;
  const { value, problems, warnings } = checked.value;
  if (problems.length > 0 || value === undefined) {
    return ok(`Claude's cues.json stayed invalid (${problems.join('; ')}); using the default cues`);
  }
  return ok({ cues: value, source: 'claude', warnings });
}

async function defaultCues(
  ctx: StageContext,
  input: DefaultCuesInput,
  durationS: number,
): Promise<Result<Produced, StageError>> {
  ctx.step('Default sound design', 60);
  const sceneSfx = ctx.sceneSfx === undefined ? [] : await ctx.sceneSfx(ctx.projectDir, ctx.signal);
  const generated = generateDefaultCues({ ...input, sceneSfx });
  const written = await writeProjectJson(ctx.projectDir, FILES.cues, CuesFileSchema, generated);
  if (!written.ok) return written;
  const check = await checkCuesFile(ctx, durationS);
  if (check.problems.length > 0 || check.value === undefined) {
    return err(stageError('validation', 'the default cues are invalid', check.problems));
  }
  return ok({ cues: check.value, source: 'default', warnings: check.warnings });
}

async function run(ctx: StageContext): Promise<Result<StageSummary, StageError>> {
  const { project } = ctx.snapshot;
  if (project.status !== 'ok') return err(stageError('not-ready', 'project.json is invalid'));
  const storyboard = await requireProjectJson(
    ctx.projectDir,
    FILES.storyboard,
    storyboardFileSchema,
  );
  if (!storyboard.ok) return storyboard;
  const words = await requireProjectJson(ctx.projectDir, FILES.words, wordsFileSchema);
  if (!words.ok) return words;
  const input: DefaultCuesInput = {
    shots: storyboard.value.shots,
    words: words.value.words,
    musicFiles: await musicFiles(ctx.projectDir),
  };
  const durationS = defaultDurationS(input);
  const warnings: string[] = [];
  let produced: Produced | undefined;
  if (ctx.settings.economy) warnings.push('Economy mode: default cues (no Claude turn)');
  else if (!ctx.hasClaude) warnings.push('Claude is not connected: default cues');
  else {
    const fromClaude = await claudeCues(ctx, project.value.style, durationS);
    if (!fromClaude.ok) return fromClaude;
    if (typeof fromClaude.value === 'string') warnings.push(fromClaude.value);
    else produced = fromClaude.value;
  }
  if (produced === undefined) {
    const fallback = await defaultCues(ctx, input, durationS);
    if (!fallback.ok) return fallback;
    produced = fallback.value;
  }
  warnings.push(...produced.warnings);
  const { sfx, ambience, music } = produced.cues;
  return ok({
    message: `${String(sfx.length)} sfx, ${String(ambience.length)} ambience, ${String(music.length)} music (${produced.source})`,
    outputs: [FILES.cues],
    changed: true,
    warnings,
    metrics: {
      source: produced.source,
      sfx: sfx.length,
      ambience: ambience.length,
      music: music.length,
    },
  });
}

export const soundCuesStage: StageDefinition<'sound-cues'> = {
  id: 'sound-cues',
  inputs: [
    FILES.storyboard,
    FILES.words,
    'audio/music/* (optional)',
    'scene sfx events (optional)',
  ],
  outputs: [FILES.cues],
  run,
};
