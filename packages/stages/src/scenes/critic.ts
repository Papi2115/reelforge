/**
 * Frame critics (PLAN.md §4.4, #7.5): the programmatic layer (blank/uniform frames, cards outside
 * the safe area or overlapping, console errors) needs no Claude; the Haiku layer reads a contact
 * sheet of the frames and answers `blank | clipped | overlap | off-intent | ok` as JSON.
 */
import { err, ok, type ModelAlias, type Result } from '@reelforge/claude-bridge';
import { isCraftNote, validateCriticReply } from '@reelforge/prompts';
import type { CriticVerdictRecord, QaFinding } from '@reelforge/shared';
import type { ClaudeTurnResult } from '../claude.js';
import { render } from '../stages/repair.js';
import type { StageError, StageTurn } from '../types.js';
import { blankFrameFindings, cardFindings, consoleFindings, finding } from './checks.js';
import { writeContactSheet } from './sheet.js';
import type { ShotRenderOk } from './tools.js';

/** Runs one Claude turn (the stage context's `claude`). */
export type TurnRunner = (turn: StageTurn) => Promise<Result<ClaudeTurnResult, StageError>>;

export interface CritiqueInput {
  readonly projectDir: string;
  readonly shotId: string;
  /** What the shot must communicate (storyboard intent). */
  readonly intent: string;
  readonly styleId: string;
  /**
   * The shot's look, roll and look rules (criticLookVars; empty in voxel-only projects) and its
   * mascot check (criticCharacterVars; only for a shot with the project's mascot).
   */
  readonly lookVars?: Readonly<Record<string, string>> | undefined;
  readonly render: ShotRenderOk;
  /** Project-relative PNG the critic reads (written here). */
  readonly sheetFile: string;
  /**
   * A world's craft check (PLAN.md#13.6): an `ok` frame whose note does not name the focal point
   * and three human traces fails like an `off-intent` one.
   */
  readonly craft?: boolean | undefined;
  /**
   * The project's research notes for this shot (`researchExcerpt`): facts are judged by them and a
   * contradiction is a `fact-conflict:` note (a ⚠, never a fix turn); undefined = none.
   */
  readonly research?: string | undefined;
  /** The critic model at least (PLAN.md#14.19: Sonnet for Grim Ink); absent = per settings. */
  readonly minModel?: ModelAlias | undefined;
}

export interface Critique {
  readonly findings: readonly QaFinding[];
  readonly verdicts: readonly CriticVerdictRecord[];
  /** Project-relative contact sheet, when one was written. */
  readonly sheet: string | undefined;
  readonly notes: readonly string[];
}

/** A critic note about storyboard vs research notes (critic prompt v10). */
const FACT_CONFLICT = /^\s*fact-conflict\s*:/i;

export function isFactConflict(entry: CriticVerdictRecord): boolean {
  return FACT_CONFLICT.test(entry.note);
}

/** A world critic's `ok` without the focal point and the traces is a `craft:` failure. */
export function craftVerdicts(verdicts: readonly CriticVerdictRecord[]): CriticVerdictRecord[] {
  return verdicts.map((entry) =>
    entry.verdict !== 'ok' || isCraftNote(entry.note) || isFactConflict(entry)
      ? entry
      : {
          verdict: 'off-intent',
          note: `craft: no focal point and three human traces named (${entry.note})`,
        },
  );
}

/** The code layer: no Claude, deterministic. */
export function programmaticCritique(render: ShotRenderOk): QaFinding[] {
  return [
    ...blankFrameFindings(render.frames),
    ...cardFindings(render.cards),
    ...consoleFindings(render.errors),
  ];
}

/**
 * Failed frames are errors (a fix turn); a fact conflict (the storyboard contradicts the research
 * notes) is a warning for the user, so no fix turn flips research-correct data back.
 */
export function verdictFindings(verdicts: readonly CriticVerdictRecord[]): QaFinding[] {
  return verdicts
    .filter((entry) => entry.verdict !== 'ok' || isFactConflict(entry))
    .map((entry) =>
      isFactConflict(entry)
        ? finding(
            'critic',
            'warning',
            `the frame critic found a fact conflict (storyboard vs research notes; check the facts before publishing): ${entry.note}`,
          )
        : finding('critic', 'error', `the frame critic says "${entry.verdict}": ${entry.note}`),
    );
}

async function askCritic(
  input: CritiqueInput,
  runTurn: TurnRunner,
): Promise<Result<{ verdicts: CriticVerdictRecord[]; notes: string[] }, StageError>> {
  const prompt = render('critic', {
    imagePaths: input.sheetFile,
    intent: input.intent,
    styleId: input.styleId,
    ...input.lookVars,
    ...(input.research === undefined ? {} : { research: input.research }),
  });
  if (!prompt.ok) return prompt;
  const turn = await runTurn({
    prompt: 'critic',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: `critic ${input.shotId}`,
    commit: false,
    detached: true,
    ...(input.minModel === undefined ? {} : { minModel: input.minModel }),
  });
  if (!turn.ok) {
    if (turn.error.kind !== 'claude') return turn;
    return ok({ verdicts: [], notes: [`the frame critic failed: ${turn.error.message}`] });
  }
  const craft = input.craft === true;
  const reply = validateCriticReply(turn.value.reply, { expectedPaths: [input.sheetFile], craft });
  if (reply.value === undefined) {
    const why = reply.issues.map((entry) => entry.message).join('; ');
    return ok({ verdicts: [], notes: [`the frame critic's reply was not valid JSON (${why})`] });
  }
  const verdicts = reply.value.frames.map(({ verdict, note }) => ({ verdict, note }));
  return ok({ verdicts: craft ? craftVerdicts(verdicts) : verdicts, notes: [] });
}

/**
 * Programmatic checks, then (with a turn runner) the Haiku critic on a contact sheet of the
 * frames. Errors are returned only for cancellation/blocked Claude; a failed or unparseable
 * critic turn becomes a note.
 */
export async function critiqueFrames(
  input: CritiqueInput,
  runTurn: TurnRunner | undefined,
): Promise<Result<Critique, StageError>> {
  const findings = programmaticCritique(input.render);
  if (runTurn === undefined) return ok({ findings, verdicts: [], sheet: undefined, notes: [] });
  const sheet = await writeContactSheet(
    input.projectDir,
    input.sheetFile,
    `${input.shotId} - smoke frames - t = local shot time`,
    [
      {
        shotId: input.shotId,
        times: input.render.frames.map((frame) => frame.t),
        render: input.render,
      },
    ],
  );
  if (!sheet.ok) return err(sheet.error);
  const critic = await askCritic(input, runTurn);
  if (!critic.ok) return critic;
  return ok({
    findings: [...findings, ...verdictFindings(critic.value.verdicts)],
    verdicts: critic.value.verdicts,
    sheet: sheet.value,
    notes: critic.value.notes,
  });
}
