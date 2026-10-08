/**
 * "Voice changed — timing out of date" (ADR-033), pure: after "Redo this sentence" the shots under
 * the redone paragraph play against old word times until Audio cleaned and Words timed run again.
 * Main derives which shots and sentences (`StageReports.voiceTiming`); this says it in words and
 * decides whether "Re-time" (the two stages queued as one group) can start now.
 */
import { plural } from '../../shared/plural.js';
import type { PipelineStageKey, StagesState } from '../../shared/stages-contract.js';
import type { VoiceTiming } from '../../shared/voiceover-contract.js';

export const RETIME_LABEL = 'Re-time';
/** Re-time = the existing stages, queued together (they stop at the first failure). */
export const RETIME_STAGES: readonly PipelineStageKey[] = ['clean', 'words'];
export const VOICE_CHANGED_CHIP = 'voice changed';
export const VOICE_CHANGED_TITLE =
  'Voice changed — timing out of date: Re-time (Voiceover step) times the words again';

const RETIME_HINT = 'Re-time cleans the audio and times the words again.';
/** Stages whose run makes Re-time wait (the voice-over import and the two stages themselves). */
const BLOCKING: readonly PipelineStageKey[] = ['voiceover', ...RETIME_STAGES];

/** The notice line, or null when the timing is current. */
export function voiceTimingText(timing: VoiceTiming | null): string | null {
  if (timing === null) return null;
  if (timing.shotIds.length === 0) {
    return `Voice changed — timing out of date (no storyboard shot is under the redone sentences yet). ${RETIME_HINT}`;
  }
  return `Voice changed — timing out of date for ${plural(timing.shotIds.length, 'shot')}: ${timing.shotIds.join(', ')}. ${RETIME_HINT}`;
}

export function voiceChangedShots(timing: VoiceTiming | null | undefined): ReadonlySet<string> {
  return new Set(timing?.shotIds ?? []);
}

export function staleSentenceIds(timing: VoiceTiming | null | undefined): ReadonlySet<string> {
  return new Set(timing?.sentenceIds ?? []);
}

/** Can Re-time start now (and why not)? `voiceBusy`: an ElevenLabs job runs. */
export function retimeButton(
  state: StagesState | undefined,
  voiceBusy: boolean,
): { readonly disabled: boolean; readonly title: string } {
  const running = state?.running?.stage;
  const waiting = BLOCKING.some(
    (stage) => running === stage || state?.queue.includes(stage) === true,
  );
  if (voiceBusy || waiting) {
    return {
      disabled: true,
      title: 'The voice-over, Audio cleaned or Words timed is running or queued.',
    };
  }
  return { disabled: false, title: 'Run Audio cleaned and Words timed again on the new voice' };
}
