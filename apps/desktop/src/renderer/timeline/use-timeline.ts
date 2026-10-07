/**
 * Everything the timeline needs from the open project (PLAN.md#6.5): the selection store, edits
 * with undo/redo, the drawn model (pending edits applied), the waveform of the playing audio and
 * the timeline length. Selected items that disappear (deleted cue, renamed shot) are dropped.
 */
import type { StoryboardShot, TimedWord } from '@reelforge/shared';
import { useEffect, useMemo, useState } from 'react';
import type { ProjectSnapshot } from '../../shared/snapshot-contract.js';
import { playbackAudioFile } from '../preview/audio-source.js';
import { lockedShotSet } from '../stages/locks-view.js';
import type { WaveformView } from './draw-timeline.js';
import { peaksDuration } from './peak-columns.js';
import { SelectionStore, useSelection, type TimelineItem } from './selection.js';
import { contentEnd, EMPTY_CUES, wordParts, type TimelineModel } from './timeline-model.js';
import { useTimelineEdits, type TimelineEditing } from './use-timeline-edits.js';
import { useWaveform } from './use-waveform.js';

const NO_SHOTS: readonly StoryboardShot[] = [];
const NO_WORDS: readonly TimedWord[] = [];

export interface TimelineState {
  readonly selection: SelectionStore;
  readonly selected: readonly TimelineItem[];
  /** First selected shot (the shots list and the chat scope follow it). */
  readonly selectedShotId: string | undefined;
  readonly editing: TimelineEditing;
  readonly model: TimelineModel;
  readonly waveform: WaveformView;
  readonly duration: number;
  /** Length of the playing audio (s; 0 while there is none or it is being read). */
  readonly audioDuration: number;
}

function itemExists(model: TimelineModel, item: TimelineItem): boolean {
  switch (item.kind) {
    case 'shot':
      return model.shots.some((shot) => shot.id === item.id);
    case 'cue':
      return item.index < model.cues[item.track].length;
    case 'word':
      return item.index < model.words.length;
  }
}

export function useTimeline(
  dir: string,
  snapshot: ProjectSnapshot | undefined,
  reload: () => Promise<void>,
  audioRevision: number,
  videoDuration: number,
): TimelineState {
  const [selection] = useState(() => new SelectionStore());
  const selected = useSelection(selection);
  const shots = snapshot?.storyboard.status === 'ok' ? snapshot.storyboard.data.shots : NO_SHOTS;
  const words = snapshot?.words.status === 'ok' ? snapshot.words.data.words : NO_WORDS;
  const cues = snapshot?.cues.status === 'ok' ? snapshot.cues.data : EMPTY_CUES;
  const editing = useTimelineEdits(dir, shots, cues, reload);
  const parts = useMemo(() => wordParts(words), [words]);
  const locks = snapshot?.locks;
  const locked = useMemo(() => lockedShotSet(locks), [locks]);
  const model = useMemo(
    () => ({ ...parts, shots: editing.shots, cues: editing.cues, locked }),
    [parts, editing.shots, editing.cues, locked],
  );
  const waveform = useWaveform(playbackAudioFile(snapshot?.files ?? []), audioRevision);

  useEffect(() => {
    selection.clear();
  }, [dir, selection]);

  useEffect(() => {
    selection.retain((item) => itemExists(model, item));
  }, [model, selection]);

  const audioEnd = waveform.kind === 'ok' ? peaksDuration(waveform.source) : 0;
  const shot = selected.find((item) => item.kind === 'shot');
  return {
    selection,
    selected,
    selectedShotId: shot?.kind === 'shot' ? shot.id : undefined,
    editing,
    model,
    waveform,
    duration: Math.max(videoDuration, contentEnd(model), audioEnd),
    audioDuration: audioEnd,
  };
}
