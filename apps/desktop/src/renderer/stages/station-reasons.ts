/**
 * Plain-language reasons for the step status sentences (docs/ux/redesign-2.4.md §3, rules 3 and
 * 7): a gating reason becomes "Needs: timed words" (no file names), a stage error becomes a short
 * cause ("your Claude usage limit was reached"; the raw text stays behind Details), a failed shot
 * becomes "the scene does not run". Pure.
 */
import type { ShotBuildRecord } from '@reelforge/shared';
import type { StageErrorInfo } from '../../shared/stages-contract.js';

/** What each step produces, as the object of "Needs: …". */
export const STEP_OUTPUTS: Readonly<Record<string, string>> = {
  script: 'the script',
  voiceover: 'your voiceover',
  clean: 'the cleaned-up audio',
  words: 'timed words',
  storyboard: 'the storyboard',
  assets: 'the photos and footage',
  scenes: 'the scenes',
  sound: 'the sound mix',
  export: 'the video',
};

/** Step names in sentences ("Kept from before: updates after the script"). */
export const STEP_NAMES: Readonly<Record<string, string>> = {
  script: 'the script',
  voiceover: 'the voiceover',
  clean: 'the audio clean-up',
  words: 'word timing',
  storyboard: 'the storyboard',
  assets: 'the assets',
  scenes: 'the scenes',
  sound: 'the sound mix',
  export: 'the export',
};

/** Stage titles in the gating reasons (STAGE_TITLES of @reelforge/stages) -> row ids. */
const TITLE_ROWS: Readonly<Record<string, string>> = {
  Script: 'script',
  'Script written': 'script',
  Voiceover: 'voiceover',
  'Audio cleaned': 'clean',
  'Words timed': 'words',
  Storyboard: 'storyboard',
  Assets: 'assets',
  'Scenes built': 'scenes',
  'Sound cues': 'sound',
  'Sound design mixed': 'sound',
  'Video exported': 'export',
};

function outputOf(title: string | undefined): string | undefined {
  const rowId = title === undefined ? undefined : TITLE_ROWS[title];
  return rowId === undefined ? undefined : STEP_OUTPUTS[rowId];
}

/** "Needs: …" for one gating reason, when it is a known kind of reason. */
export function needsFromReason(reason: string): string | undefined {
  if (reason.includes('asset package is waiting for your review')) {
    return 'Needs: your review of the asset package';
  }
  if (reason.startsWith('Approve the script first')) return 'Needs: your approval of the script';
  if (reason.startsWith('brief.json') || reason.startsWith('The brief')) return 'Needs: the brief';
  if (reason.startsWith('Assets: run it first')) return 'Needs: the photos and footage';
  const stale = /^(.+?) is out of date(?: \((.+?)\))?/.exec(reason);
  const staleOutput = outputOf(stale?.[1]);
  if (stale !== null && staleOutput !== undefined) {
    const why = stale[2] === undefined ? '' : ` (${stale[2]})`;
    return `Needs: ${staleOutput} made again${why}`;
  }
  const busy = outputOf(/^(.+?) is still running\./.exec(reason)?.[1]);
  if (busy !== undefined) return `Needs: ${busy} (being made now)`;
  const missing = outputOf(/\brun (.+?) first\b/.exec(reason)?.[1]);
  return missing === undefined ? undefined : `Needs: ${missing}`;
}

/** Short causes of a stage error by kind (StageErrorKind of @reelforge/stages). */
const ERROR_CAUSES: Readonly<Record<string, string>> = {
  busy: 'another step was running',
  'missing-tool': 'a tool it needs is missing (Settings → Tools)',
  blocked: 'Claude could not start (check the connection in Settings)',
  limit: 'your Claude usage limit was reached',
  claude: 'Claude stopped with an error',
  validation: "Claude's result did not pass the checks",
  tool: 'the audio or video tool stopped with an error',
  io: 'a project file could not be read or written',
  cancelled: 'you stopped it',
};

/** The cause of a failed run in plain words; the raw message stays behind Details. */
export function errorCause(error: StageErrorInfo | null): string {
  if (error === null) return 'the last run stopped with an error';
  return ERROR_CAUSES[error.kind] ?? error.message;
}

const CRITIC_CAUSES: Readonly<Record<string, string>> = {
  blank: 'blank frames',
  clipped: 'something is cut off',
  overlap: 'things overlap',
  'off-intent': 'it does not show what the shot plans',
};

/** Why a shot failed its check, in plain words. */
export function shotFailureCause(record: ShotBuildRecord): string {
  if (record.findings.some((finding) => finding.fatal)) return 'the scene does not run';
  const verdict = record.critic.find((candidate) => candidate.verdict !== 'ok');
  const critic = verdict === undefined ? undefined : CRITIC_CAUSES[verdict.verdict];
  if (critic !== undefined) return critic;
  if (record.missingProps.length > 0) return `missing ${record.missingProps.join(', ')}`;
  return 'it did not pass the check';
}
