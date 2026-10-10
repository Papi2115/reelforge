/**
 * Dramaturgy in the stages (PLAN.md#12.25–12.27, ADR-020), each behind its project switch (absent
 * = off: prompts, validators and outputs exactly as before):
 * - Script: the prompt asks for "## Surprise beats" / "## Open loops" notes in beats.md.
 * - Storyboard: interrupt markers (validated, locked shots keep theirs) and `loops.json`
 *   (⚠ analysis as warnings); the dramaturgy report (planned interrupts, loop warnings).
 * - Scenes: the build prompt gets the shot's interrupt directive and its loop veil directive; the
 *   final review rewrites the report with the interrupts realised in the scene sources.
 * - Mix: accepted silence-hit moments duck the bed and add the hit.
 */
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  checkInterrupts,
  interruptTarget,
  validateLoops,
  worldPromptText,
  type InterruptCheckOptions,
} from '@reelforge/prompts';
import {
  buildInterruptReport,
  DRAMATURGY_REPORT_FILE,
  DRAMATURGY_REPORT_VERSION,
  dramaturgyReportSchema,
  interruptDirective,
  LOOPS_FILE,
  loopsClosingIn,
  loopsFileSchema,
  loopsOpeningIn,
  momentMixEffects,
  MOMENTS_FILE,
  momentsFileSchema,
  projectOpenLoops,
  projectPatternInterrupts,
  projectRevealMoments,
  storyboardFileSchema,
  targetInterruptRate,
  tensionSpans,
  type DramaturgyReport,
  type Interrupt,
  type LoopsFile,
  type MixSilence,
  type OpenLoop,
  type ProjectFile,
  type StoryboardShot,
  type TensionFile,
  type WordsFile,
} from '@reelforge/shared';
import { readProjectText, writeProjectJson } from './files.js';
import { readLockedShots } from './locks.js';
import { FILES } from './paths.js';
import type { StageError } from './types.js';

type Switches = Pick<ProjectFile, 'patternInterrupts' | 'openLoops' | 'revealMoments'> &
  Partial<Pick<ProjectFile, 'style'>>;

/** Script prompt vars (empty with both switches off). */
export function scriptDramaturgyVars(project: Switches): Record<string, string | boolean | number> {
  const interrupts = projectPatternInterrupts(project) === 'auto';
  const loops = projectOpenLoops(project) === 'auto';
  return {
    ...(interrupts ? { surpriseBeats: true, interruptsPerMinute: '1–2' } : {}),
    ...(loops ? { openLoops: true, openLoopsStep: interrupts ? 4 : 3 } : {}),
  };
}

const clock = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, '0')}`;
};

function narrationS(words: WordsFile): number {
  return words.words.at(-1)?.tEnd ?? 0;
}

/** Storyboard prompt vars (empty with both switches off). */
export function storyboardDramaturgyVars(
  project: Switches,
  words: WordsFile,
  tension: Pick<TensionFile, 'points' | 'segments'> | undefined,
): Record<string, string | boolean> {
  const vars: Record<string, string | boolean> = {};
  if (projectPatternInterrupts(project) === 'auto') {
    const durationS = narrationS(words);
    const range = interruptTarget(durationS, tension?.points);
    vars['interrupts'] = true;
    vars['interruptRules'] =
      `Plan ${String(range.min)}–${String(range.max)} interrupts in this ${clock(durationS)} film (1–2 per minute), none before 5 s, at least 15 s apart; keep the markers of locked shots as they are.`;
    if (tension !== undefined) {
      vars['interruptTension'] = tensionSpans(tension, durationS)
        .map(
          (span) =>
            `- ${clock(span.from)}–${clock(span.to)} ${span.kind}, tension ${span.mean.toFixed(2)}: ~${targetInterruptRate(span.mean).toFixed(1)} per minute`,
        )
        .join('\n');
    }
  }
  if (projectOpenLoops(project) === 'auto') vars['loops'] = true;
  return vars;
}

/** The interrupts locked shots had before the turn (they must keep them). */
export async function lockedInterrupts(
  projectDir: string,
): Promise<Result<Map<string, Interrupt | undefined>, StageError>> {
  const locked = await readLockedShots(projectDir);
  if (!locked.ok) return locked;
  const markers = new Map<string, Interrupt | undefined>();
  if (locked.value.size === 0) return ok(markers);
  const text = await readProjectText(projectDir, FILES.storyboard);
  if (!text.ok) return text;
  const parsed = storyboardFileSchema.safeParse(safeJson(text.value ?? ''));
  const shots = parsed.success ? parsed.data.shots : [];
  for (const id of locked.value) markers.set(id, shots.find((shot) => shot.id === id)?.interrupt);
  return ok(markers);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // An unreadable previous storyboard has no markers to keep.
    return undefined;
  }
}

/** Interrupt check options of the storyboard validator (undefined with the switch off). */
export function interruptOptions(
  project: Switches,
  tension: Pick<TensionFile, 'points'> | undefined,
  locked: ReadonlyMap<string, Interrupt | undefined>,
): InterruptCheckOptions | undefined {
  if (projectPatternInterrupts(project) !== 'auto') return undefined;
  // A world that only cuts (Grim Ink) never asks for a look-change transition (PLAN.md#14.18).
  const cutsOnly = worldPromptText(project.style)?.cutsOnly === true;
  return {
    locked,
    ...(tension === undefined ? {} : { tension: tension.points }),
    ...(cutsOnly ? { cutsOnly } : {}),
  };
}

export interface LoopsOutcome {
  readonly file: LoopsFile | undefined;
  /** ⚠ lines (analysis and file problems). */
  readonly warnings: string[];
  readonly problem: string | undefined;
}

/** Reads and checks loops.json (switch on); never fails the stage. */
export async function checkLoops(
  projectDir: string,
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
): Promise<LoopsOutcome> {
  const text = await readProjectText(projectDir, LOOPS_FILE);
  if (!text.ok)
    return { file: undefined, warnings: [`⚠ ${text.error.message}`], problem: text.error.message };
  if (text.value === undefined) {
    const problem = `${LOOPS_FILE} was not written`;
    return {
      file: undefined,
      warnings: [`⚠ ${problem}: the film has no planned open loops`],
      problem,
    };
  }
  const report = validateLoops(text.value, { shots, ...(words === undefined ? {} : { words }) });
  const warnings = report.issues.map((entry) =>
    entry.message.startsWith('⚠') ? entry.message : `⚠ ${entry.message}`,
  );
  return {
    file: report.value,
    warnings,
    problem: report.value === undefined ? `${LOOPS_FILE} is invalid` : undefined,
  };
}

/** Writes the dramaturgy report (`.reelforge/reports/dramaturgy.json`). */
export async function writeDramaturgyReport(
  projectDir: string,
  now: Date,
  source: DramaturgyReport['source'],
  parts: {
    readonly shots?: readonly StoryboardShot[] | undefined;
    readonly sources?: ReadonlyMap<string, string> | undefined;
    readonly loops?: LoopsOutcome | undefined;
  },
): Promise<Result<DramaturgyReport, StageError>> {
  const loops = parts.loops;
  const report: DramaturgyReport = {
    version: DRAMATURGY_REPORT_VERSION,
    createdAt: now.toISOString(),
    source,
    ...(parts.shots === undefined
      ? {}
      : { interrupts: buildInterruptReport(parts.shots, parts.sources ?? new Map()) }),
    ...(loops === undefined
      ? {}
      : {
          loops: {
            count: loops.file?.loops.length ?? 0,
            open: loops.file?.loops.filter((loop) => loop.status === 'open').length ?? 0,
            warnings: loops.warnings,
            ...(loops.problem === undefined ? {} : { problem: loops.problem }),
          },
        }),
  };
  return writeProjectJson(projectDir, DRAMATURGY_REPORT_FILE, dramaturgyReportSchema, report);
}

/** Storyboard run: the interrupt warnings worth a line in the stage record. */
export function interruptSummary(
  shots: readonly StoryboardShot[],
  options: InterruptCheckOptions,
): string[] {
  return checkInterrupts(shots, options)
    .filter((entry) => entry.severity === 'warning')
    .map((entry) => `⚠ ${entry.message}`);
}

export interface SceneDramaturgy {
  readonly interrupts: boolean;
  readonly loops: LoopsFile | undefined;
}

/** What the scenes stage needs (switches + loops.json); both off = nothing changes. */
export async function loadSceneDramaturgy(
  projectDir: string,
  project: Switches,
): Promise<SceneDramaturgy> {
  const interrupts = projectPatternInterrupts(project) === 'auto';
  if (projectOpenLoops(project) !== 'auto') return { interrupts, loops: undefined };
  const text = await readProjectText(projectDir, LOOPS_FILE);
  if (!text.ok || text.value === undefined) return { interrupts, loops: undefined };
  const parsed = loopsFileSchema.safeParse(safeJson(text.value));
  return { interrupts, loops: parsed.success ? parsed.data : undefined };
}

const VEILS =
  'the kit veil of the look: voxel `kit.props.veiledProp` (`cover(object)`), retro-ui `kit.props.redactedBlock`, blueprint `kit.fx.maskedRegion`';

function closingLine(loop: OpenLoop): string {
  const point = loop.closedAt ?? loop.plannedCloseAt;
  const phrase = point.phrase === undefined ? `at ${point.t.toFixed(2)} s` : `on "${point.phrase}"`;
  return `this shot answers "${loop.question}" ${phrase}: keep the answer covered until then and reveal it ${phrase} with ${VEILS} (\`revealAt\`: ${point.phrase === undefined ? 'that local time' : `ctx.anchor(${JSON.stringify(point.phrase)}).t`}).`;
}

function openingLine(loop: OpenLoop): string {
  return `this shot opens the question "${loop.question}": show the covered object (${VEILS}) without revealing it.`;
}

/** Scene-build prompt vars of one shot (empty when the switches are off or nothing applies). */
export function sceneDramaturgyVars(
  dramaturgy: SceneDramaturgy | undefined,
  shots: readonly StoryboardShot[],
  shot: StoryboardShot,
): Record<string, string> {
  if (dramaturgy === undefined) return {};
  const vars: Record<string, string> = {};
  if (dramaturgy.interrupts && shot.interrupt !== undefined) {
    const index = shots.findIndex((candidate) => candidate.id === shot.id);
    vars['interruptDirective'] = interruptDirective(shot, shots[index - 1]);
  }
  const loops = dramaturgy.loops;
  if (loops !== undefined) {
    const lines = [
      ...loopsOpeningIn(loops, shot.id)
        .filter((loop) => loop.veil === true)
        .map(openingLine),
      ...loopsClosingIn(loops, shot.id)
        .filter((loop) => loop.veil === true)
        .map(closingLine),
    ];
    if (lines.length > 0) vars['veilDirective'] = lines.join(' ');
  }
  return vars;
}

/** Scene sources of the storyboard shots (missing files are left out). */
export async function sceneSources(
  projectDir: string,
  shots: readonly StoryboardShot[],
): Promise<Map<string, string>> {
  const sources = new Map<string, string>();
  for (const shot of shots) {
    const text = await readProjectText(projectDir, shot.scene);
    if (text.ok && text.value !== undefined) sources.set(shot.id, text.value);
  }
  return sources;
}

export interface MixMoments {
  readonly silences: MixSilence[];
  readonly hits: number[];
  /** moments.json is unreadable (the mix goes on without moments). */
  readonly problem?: string;
}

/** Accepted silence hits for the mix (none with the switch off or no moments.json). */
export async function mixMoments(projectDir: string, project: Switches): Promise<MixMoments> {
  if (projectRevealMoments(project) !== 'auto') return { silences: [], hits: [] };
  const text = await readProjectText(projectDir, MOMENTS_FILE);
  if (!text.ok) return { silences: [], hits: [], problem: text.error.message };
  if (text.value === undefined) return { silences: [], hits: [] };
  const parsed = momentsFileSchema.safeParse(safeJson(text.value));
  if (!parsed.success) {
    return {
      silences: [],
      hits: [],
      problem: `${MOMENTS_FILE} is invalid: reveal moments skipped`,
    };
  }
  return momentMixEffects(parsed.data.moments);
}

export interface StoryboardDramaturgy {
  /** Prompt vars (empty with both switches off). */
  readonly vars: Record<string, string | boolean>;
  /** Validator options (undefined with pattern interrupts off). */
  readonly interrupts: InterruptCheckOptions | undefined;
}

/** Before the storyboard turn: prompt vars and the locked shots' markers as they are now. */
export async function prepareStoryboardDramaturgy(
  projectDir: string,
  project: Switches,
  words: WordsFile,
  tension: Pick<TensionFile, 'points' | 'segments'> | undefined,
): Promise<Result<StoryboardDramaturgy, StageError>> {
  const vars = storyboardDramaturgyVars(project, words, tension);
  if (projectPatternInterrupts(project) !== 'auto') return ok({ vars, interrupts: undefined });
  const locked = await lockedInterrupts(projectDir);
  if (!locked.ok) return locked;
  return ok({ vars, interrupts: interruptOptions(project, tension, locked.value) });
}

/** After the storyboard: loops.json checked, the dramaturgy report written; ⚠ lines returned. */
export async function finishStoryboardDramaturgy(
  projectDir: string,
  now: Date,
  project: Switches,
  shots: readonly StoryboardShot[],
  words: WordsFile,
): Promise<Result<string[], StageError>> {
  const interrupts = projectPatternInterrupts(project) === 'auto';
  const loopsOn = projectOpenLoops(project) === 'auto';
  if (!interrupts && !loopsOn) return ok([]);
  const loops = loopsOn ? await checkLoops(projectDir, shots, words) : undefined;
  const written = await writeDramaturgyReport(projectDir, now, 'storyboard', {
    ...(interrupts ? { shots } : {}),
    ...(loops === undefined ? {} : { loops }),
  });
  if (!written.ok) return written;
  return ok(loops?.warnings ?? []);
}

/**
 * Final review: the dramaturgy report with the interrupts realised in the scene sources and the
 * loop warnings again; returns the ⚠ note lines for the review (empty with the switches off).
 */
export async function finalReviewDramaturgy(
  projectDir: string,
  now: Date,
  project: Switches,
  shots: readonly StoryboardShot[],
  words: WordsFile | undefined,
): Promise<Result<string[], StageError>> {
  const interrupts = projectPatternInterrupts(project) === 'auto';
  const loopsOn = projectOpenLoops(project) === 'auto';
  if (!interrupts && !loopsOn) return ok([]);
  const loops = loopsOn ? await checkLoops(projectDir, shots, words) : undefined;
  const sources = interrupts ? await sceneSources(projectDir, shots) : undefined;
  const written = await writeDramaturgyReport(projectDir, now, 'final-review', {
    ...(interrupts ? { shots, sources } : {}),
    ...(loops === undefined ? {} : { loops }),
  });
  if (!written.ok) return written;
  const notes = [...(loops?.warnings ?? [])];
  const report = written.value.interrupts;
  if (report !== undefined && report.realised < report.planned) {
    const missing = report.shots
      .filter((entry) => entry.realisedBy === null)
      .map((entry) => `${entry.shotId} ${entry.kind}`);
    notes.push(
      `⚠ pattern interrupts: ${String(report.planned)} planned, ${String(report.realised)} in the frames (not realised: ${missing.join(', ')})`,
    );
  }
  return ok(notes);
}
