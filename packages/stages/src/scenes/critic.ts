/**
 * Frame critics (PLAN.md §4.4, #7.5): the programmatic layer (blank/uniform frames, cards outside
 * the safe area or overlapping, console errors) needs no Claude; the Haiku layer reads a contact
 * sheet of the frames and answers `blank | clipped | overlap | off-intent | ok` as JSON.
 */
import { err, ok, type Result } from '@reelforge/claude-bridge';
import { validateCriticReply } from '@reelforge/prompts';
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
  readonly render: ShotRenderOk;
  /** Project-relative PNG the critic reads (written here). */
  readonly sheetFile: string;
}

export interface Critique {
  readonly findings: readonly QaFinding[];
  readonly verdicts: readonly CriticVerdictRecord[];
  /** Project-relative contact sheet, when one was written. */
  readonly sheet: string | undefined;
  readonly notes: readonly string[];
}

/** The code layer: no Claude, deterministic. */
export function programmaticCritique(render: ShotRenderOk): QaFinding[] {
  return [
    ...blankFrameFindings(render.frames),
    ...cardFindings(render.cards),
    ...consoleFindings(render.errors),
  ];
}

function verdictFindings(verdicts: readonly CriticVerdictRecord[]): QaFinding[] {
  return verdicts
    .filter((entry) => entry.verdict !== 'ok')
    .map((entry) =>
      finding('critic', 'error', `the frame critic says "${entry.verdict}": ${entry.note}`),
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
  });
  if (!prompt.ok) return prompt;
  const turn = await runTurn({
    prompt: 'critic',
    text: prompt.value,
    purpose: 'qa',
    newSession: true,
    label: `critic ${input.shotId}`,
    commit: false,
    resumeAfterLimit: false,
  });
  if (!turn.ok) {
    if (turn.error.kind !== 'claude') return turn;
    return ok({ verdicts: [], notes: [`the frame critic failed: ${turn.error.message}`] });
  }
  const reply = validateCriticReply(turn.value.reply, { expectedPaths: [input.sheetFile] });
  if (reply.value === undefined) {
    const why = reply.issues.map((entry) => entry.message).join('; ');
    return ok({ verdicts: [], notes: [`the frame critic's reply was not valid JSON (${why})`] });
  }
  return ok({
    verdicts: reply.value.frames.map(({ verdict, note }) => ({ verdict, note })),
    notes: [],
  });
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
