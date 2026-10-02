/**
 * Voice-over <-> script discrepancy report (PLAN.md#7.2): recording length vs. script length at
 * 150 wpm on import; the words stage later adds how much of the script the recording covers.
 */
import { countWords, WORDS_PER_MINUTE } from '@reelforge/prompts';
import {
  VO_REPORT_VERSION,
  voReportSchema,
  type VoReport,
  type VoVerdict,
} from '@reelforge/shared';
import type { Result } from '@reelforge/claude-bridge';
import { writeProjectJson } from '../files.js';
import { REPORTS, inProject } from '../paths.js';
import { loadJson } from '../snapshot.js';
import type { StageError } from '../types.js';

/** Plausible narration pace; outside it the recording and the script probably differ. */
export const MIN_PLAUSIBLE_WPM = 110;
export const MAX_PLAUSIBLE_WPM = 190;

export function buildVoReport(durationS: number | null, scriptText: string | undefined): VoReport {
  const scriptWords = scriptText === undefined ? null : countWords(scriptText);
  const expectedDurationS =
    scriptWords === null ? null : Math.round((scriptWords / WORDS_PER_MINUTE) * 600) / 10;
  const messages: string[] = [];
  let verdict: VoVerdict = 'unknown';
  let wordsPerMinute: number | null = null;
  if (scriptWords === null) messages.push('No script.txt yet: nothing to compare against.');
  if (durationS === null) messages.push('The recording length is unknown (ffmpeg not available).');
  if (scriptWords !== null && durationS !== null && durationS > 0) {
    wordsPerMinute = Math.round((scriptWords / (durationS / 60)) * 10) / 10;
    if (wordsPerMinute > MAX_PLAUSIBLE_WPM) {
      verdict = 'too-short';
      messages.push(
        `The recording is short for the script (${String(wordsPerMinute)} wpm): parts of the script may not be recorded.`,
      );
    } else if (wordsPerMinute < MIN_PLAUSIBLE_WPM) {
      verdict = 'too-long';
      messages.push(
        `The recording is long for the script (${String(wordsPerMinute)} wpm): it may contain text that is not in the script, or long pauses.`,
      );
    } else {
      verdict = 'ok';
    }
  }
  return {
    version: VO_REPORT_VERSION,
    durationS,
    scriptWords,
    expectedDurationS,
    wordsPerMinute,
    verdict,
    messages,
    alignment: null,
  };
}

export function writeVoReport(
  projectDir: string,
  report: VoReport,
): Promise<Result<VoReport, StageError>> {
  return writeProjectJson(projectDir, REPORTS.voiceover, voReportSchema, report);
}

/** Adds the words stage's alignment result to an existing report (no-op without one). */
export async function addAlignmentToVoReport(
  projectDir: string,
  alignment: NonNullable<VoReport['alignment']>,
): Promise<Result<VoReport | undefined, StageError>> {
  const current = await loadJson(inProject(projectDir, REPORTS.voiceover), voReportSchema);
  if (current.status !== 'ok') return { ok: true, value: undefined };
  const messages = current.value.messages.filter((line) => !line.startsWith('Alignment:'));
  if (alignment.coverage < 0.85) {
    messages.push(
      `Alignment: only ${String(Math.round(alignment.coverage * 100))} % of the script was found in the recording.`,
    );
  }
  return writeVoReport(projectDir, { ...current.value, messages, alignment });
}
