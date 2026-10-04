/**
 * Sound cues (PLAN.md#8.1): the deterministic sound design (`sound/design.ts`: director SFX,
 * ambience, generated per-act music) is written to `cues.json` first; then Claude (sound-cues
 * prompt) adjusts it — it may move, add or remove cues and change the act `moods` (the stage then
 * re-renders those beds). Claude's file is validated against the pipeline's `CuesFileSchema` and
 * the prompt's mixing rules with one repair turn. In Economy mode, without Claude, when Claude
 * cannot run, or when its cues stay invalid, the deterministic design is kept (with a warning).
 */
import { existsSync } from 'node:fs';
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { CuesFileSchema, MUSIC_MOODS, type CuesFile } from '@reelforge/pipeline';
import { validateCues } from '@reelforge/prompts';
import {
  projectLookMode,
  storyboardFileSchema,
  wordsFileSchema,
  type StoryboardShot,
} from '@reelforge/shared';
import { GridTimes } from '../beat-sync/grid.js';
import { snapWhooshCues } from '../beat-sync/snap.js';
import { activeBeatGrid, reportSoundSync } from '../beat-sync/stage.js';
import { reviewRepetitions } from '../repetition/stage.js';
import { readProjectText, requireProjectJson, writeProjectJson } from '../files.js';
import { FILES, inProject } from '../paths.js';
import { applyMoodHint, designSound, type SoundDesign } from '../sound/design.js';
import { activeTension } from '../tension.js';
import {
  stageError,
  type StageContext,
  type StageDefinition,
  type RequestOf,
  type StageError,
  type StageSummary,
} from '../types.js';
import { checkWithRepair, errorLines, render, warningLines, type OutputCheck } from './repair.js';

/** Claude failures that keep the default cues (anything else stops the stage). */
const FALLBACK_KINDS = new Set<StageError['kind']>(['blocked', 'claude', 'missing-tool']);

async function checkCuesFile(
  ctx: StageContext,
  design: SoundDesign,
): Promise<OutputCheck<CuesFile>> {
  const text = await readProjectText(ctx.projectDir, FILES.cues);
  if (!text.ok) return { value: undefined, problems: [text.error.message], warnings: [] };
  if (text.value === undefined) {
    return { value: undefined, problems: [`${FILES.cues} was not written`], warnings: [] };
  }
  const report = validateCues(text.value, {
    schema: CuesFileSchema,
    durationS: design.durationS,
    musicFileExists: (file) => existsSync(inProject(ctx.projectDir, file)),
    actCount: design.moods.length > 0 ? design.acts.length : undefined,
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

/** One line per act for the prompt, e.g. `1: 0–61 s, intro, energy 0.45, mood calm-tech`. */
function actLines(design: SoundDesign): string {
  return design.acts
    .map((act, index) => {
      const mood = design.moods[index];
      return `${String(index + 1)}: ${String(act.from)}–${String(act.to)} s, ${act.role}, energy ${String(act.energy)}${mood === undefined ? '' : `, mood ${mood}`}`;
    })
    .join('\n');
}

/** Claude's adjusted cues, or (a string) the reason to keep the default cues. */
async function claudeCues(
  ctx: StageContext,
  styleId: string,
  design: SoundDesign,
): Promise<Result<Produced | string, StageError>> {
  const prompt = render('sound-cues', {
    styleId,
    moodNames: MUSIC_MOODS.join(', '),
    acts: design.moods.length > 0 ? actLines(design) : undefined,
  });
  if (!prompt.ok) return prompt;
  ctx.step('Claude: sound design', 30);
  const turn = await ctx.claude({
    prompt: 'sound-cues',
    text: prompt.value,
    purpose: 'main',
    newSession: false,
    label: 'sound cues',
  });
  if (!turn.ok) {
    return FALLBACK_KINDS.has(turn.error.kind)
      ? ok(`Claude could not adjust the cues (${turn.error.message}); using the default cues`)
      : turn;
  }
  const checked = await checkWithRepair({
    ctx,
    prompt: 'sound-cues',
    purpose: 'main',
    file: FILES.cues,
    label: 'sound cues',
    check: () => checkCuesFile(ctx, design),
  });
  if (!checked.ok) return checked;
  const { value, problems, warnings } = checked.value;
  if (problems.length > 0 || value === undefined) {
    return ok(`Claude's cues.json stayed invalid (${problems.join('; ')}); using the default cues`);
  }
  return ok({ cues: value, source: 'claude', warnings });
}

async function writeCues(
  ctx: StageContext,
  cues: CuesFile | SoundDesign['cues'],
  design: SoundDesign,
): Promise<Result<OutputCheck<CuesFile>, StageError>> {
  const written = await writeProjectJson(ctx.projectDir, FILES.cues, CuesFileSchema, cues);
  if (!written.ok) return written;
  const check = await checkCuesFile(ctx, design);
  if (check.problems.length > 0 || check.value === undefined) {
    return err(stageError('validation', 'the default cues are invalid', check.problems));
  }
  return ok(check);
}

interface Prepared {
  readonly design: SoundDesign;
  readonly styleId: string;
  readonly seed: number;
  readonly shots: readonly StoryboardShot[];
}

async function prepare(ctx: StageContext): Promise<Result<Prepared, StageError>> {
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
  ctx.step('Default sound design', 5);
  const { style: styleId, seed } = project.value;
  // Tension map (PLAN.md#12.22): act moods/energy and SFX density follow the curve when it is on.
  const tension = await activeTension(ctx.projectDir, project.value);
  // Beat sync (PLAN.md#12.21): the grid locks the beds and snaps hits; off = undefined.
  const beats = await activeBeatGrid(ctx.projectDir, project.value, {
    shots: storyboard.value.shots,
    words: words.value.words,
    styleId,
    tension: tension?.points,
  });
  if (!beats.ok) return beats;
  const design = await designSound({
    projectDir: ctx.projectDir,
    shots: storyboard.value.shots,
    words: words.value.words,
    styleId,
    seed,
    musicEnabled: ctx.settings.music.enabled,
    lookMode: projectLookMode(project.value),
    tension: tension?.points,
    beats: beats.value,
    sceneSfx: ctx.sceneSfx,
    signal: ctx.signal,
    onStep: (label) => {
      ctx.step(label, 10);
    },
  });
  return design.ok
    ? ok({ design: design.value, styleId, seed, shots: storyboard.value.shots })
    : design;
}

/** Claude's valid cues with the beds of its `moods` re-rendered when it changed any. */
async function withMoodHint(
  ctx: StageContext,
  produced: Produced,
  prepared: Prepared,
): Promise<Result<Produced, StageError>> {
  const hinted = await applyMoodHint(produced.cues, prepared.design, {
    projectDir: ctx.projectDir,
    seed: prepared.seed,
  });
  if (!hinted.ok) return hinted;
  if (hinted.value === null) return ok(produced);
  ctx.step('Re-rendered the music for the new moods', 95);
  const rewritten = await writeCues(ctx, hinted.value, prepared.design);
  if (!rewritten.ok) return rewritten;
  return ok({ ...produced, cues: rewritten.value.value ?? hinted.value });
}

/**
 * Beat sync (PLAN.md#12.21): the whooshes of the final cues (scene accents, Claude's cues) snapped
 * to the grid and written; a snapped file that fails validation is put back (warning).
 */
async function snapFinalWhooshes(
  ctx: StageContext,
  produced: Produced,
  prepared: Prepared,
): Promise<Result<{ produced: Produced; snapped: number; warning?: string }, StageError>> {
  const { design, shots } = prepared;
  if (design.beats === undefined) return ok({ produced, snapped: 0 });
  const cuts = shots.slice(1).map((shot) => shot.t0);
  const snap = snapWhooshCues(
    produced.cues.sfx,
    new GridTimes(design.beats),
    cuts,
    design.sceneAnchors,
  );
  if (snap.snapped === 0) return ok({ produced, snapped: 0 });
  const snapped = { ...produced.cues, sfx: snap.cues };
  const written = await writeProjectJson(ctx.projectDir, FILES.cues, CuesFileSchema, snapped);
  if (!written.ok) return written;
  const check = await checkCuesFile(ctx, design);
  if (check.problems.length === 0 && check.value !== undefined) {
    return ok({ produced: { ...produced, cues: check.value }, snapped: snap.snapped });
  }
  const restored = await writeProjectJson(
    ctx.projectDir,
    FILES.cues,
    CuesFileSchema,
    produced.cues,
  );
  if (!restored.ok) return restored;
  const warning = `beat sync: whooshes left as they were (snapped cues: ${check.problems.join('; ')})`;
  return ok({ produced, snapped: 0, warning });
}

async function run(
  ctx: StageContext,
  request: RequestOf<'sound-cues'>,
): Promise<Result<StageSummary, StageError>> {
  const prepared = await prepare(ctx);
  if (!prepared.ok) return prepared;
  const { design } = prepared.value;
  const defaults = await writeCues(ctx, design.cues, design);
  if (!defaults.ok) return defaults;
  const warnings: string[] = [];
  let produced: Produced = {
    cues: defaults.value.value ?? CuesFileSchema.parse(design.cues),
    source: 'default',
    warnings: defaults.value.warnings,
  };
  if (request.mode === 'default') warnings.push('Default cues requested (no Claude turn)');
  else if (ctx.settings.economy) warnings.push('Economy mode: default cues (no Claude turn)');
  else if (!ctx.hasClaude) warnings.push('Claude is not connected: default cues');
  else {
    const fromClaude = await claudeCues(ctx, prepared.value.styleId, design);
    if (!fromClaude.ok) return fromClaude;
    if (typeof fromClaude.value === 'string') {
      warnings.push(fromClaude.value);
      const restored = await writeCues(ctx, design.cues, design);
      if (!restored.ok) return restored;
    } else {
      const hinted = await withMoodHint(ctx, fromClaude.value, prepared.value);
      if (!hinted.ok) return hinted;
      produced = hinted.value;
    }
  }
  warnings.push(...produced.warnings);
  const whooshes = await snapFinalWhooshes(ctx, produced, prepared.value);
  if (!whooshes.ok) return whooshes;
  produced = whooshes.value.produced;
  if (whooshes.value.warning !== undefined) warnings.push(whooshes.value.warning);
  const { sfx, ambience, music, moods } = produced.cues;
  const grid = prepared.value.design.beats;
  if (grid !== undefined) {
    const synced = await reportSoundSync(ctx.projectDir, grid, prepared.value.shots, sfx, {
      director: design.snappedCues,
      whooshes: whooshes.value.snapped,
    });
    if (!synced.ok) return synced;
  }
  // Repetition control (PLAN.md#12.23): the fresh cues analysed with the rest of the film.
  warnings.push(...(await reviewRepetitions(ctx.projectDir, ctx.snapshot.project)));
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
      acts: design.acts.length,
      moods: moods === undefined ? null : moods.join(', '),
    },
  });
}

export const soundCuesStage: StageDefinition<'sound-cues'> = {
  id: 'sound-cues',
  inputs: [
    FILES.storyboard,
    FILES.words,
    'audio/music/* (optional)',
    'scene sfx events and anchors (optional)',
  ],
  outputs: [FILES.cues, 'audio/music/gen-*.wav'],
  run,
};
