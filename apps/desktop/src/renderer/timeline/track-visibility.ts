/**
 * Hide until usable (docs/ux/redesign-2.4.md §5): timeline rows with nothing to show are left out
 * instead of drawing "No … yet" lines. Cards never shows (on-screen cards are not drawn on the
 * timeline); Shots, Narration and Ambience / Music show once they have content; Cues and Audio
 * once the project has audio. With nothing at all, one Narration line says what fills it. The
 * Tension and Tracks tools wait for timed words. Pure.
 */
import type { WaveformView } from './draw-timeline.js';
import type { TimelineModel, ToggleTrack } from './timeline-model.js';

/** The one line of an empty timeline (drawn in the Narration row). */
export const EMPTY_TIMELINE_TEXT =
  'Nothing on the timeline yet: it fills in once your voiceover is in';

/** Rows hidden because they have nothing to show (on top of the ones the user hid). */
export function unusableTracks(model: TimelineModel, waveform: WaveformView): Set<ToggleTrack> {
  const hasAudio = !(waveform.kind === 'message' && waveform.missing === true);
  const hidden = new Set<ToggleTrack>(['cards']);
  if (model.shots.length === 0) hidden.add('shots');
  if (model.words.length === 0) hidden.add('narration');
  if (model.cues.ambience.length === 0 && model.cues.music.length === 0) hidden.add('ambience');
  if (!hasAudio) {
    hidden.add('audio');
    if (model.cues.sfx.length === 0) hidden.add('cues');
  }
  const rows: readonly ToggleTrack[] = ['shots', 'narration', 'cues', 'audio', 'ambience'];
  if (rows.every((track) => hidden.has(track))) hidden.delete('narration');
  return hidden;
}

/** Tension and the Tracks menu are useful once there are timed words. */
export function timelineToolsUsable(model: TimelineModel): boolean {
  return model.words.length > 0;
}
