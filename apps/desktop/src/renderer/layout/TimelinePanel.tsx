/**
 * Timeline (PLAN.md#6.5, #11.2): toolbar (zoom, fit, undo/redo, gain of the selected cue, the
 * Tracks menu that shows / hides rows (remembered), save status), track labels, the canvas lanes (timeline/TimelineCanvas.tsx) with a horizontal scrollbar, and
 * the sound picker opened by double-clicking the Cues track. The playhead follows the player;
 * clicks and ruler drags seek / scrub through the player API. A boundary move that changes a locked
 * shot's length asks first (PLAN.md#11.4).
 */
import { useEffect, useMemo, useRef, useState, type JSX, type RefObject } from 'react';
import { z } from 'zod';
import type { LibrarySound } from '../../shared/sound-contract.js';
import type { FileEdits } from '../../shared/timeline-contract.js';
import { ConfirmDialog } from '../project/ConfirmDialog.js';
import { lockedLengthChanges, lockedLengthQuestion } from '../stages/locks-view.js';
import { decodeSoundDrag, SOUND_DRAG_TYPE } from '../sound/sound-view.js';
import type { WaveformView } from '../timeline/draw-timeline.js';
import { itemKey, selectedCues, useSelection, type SelectionStore } from '../timeline/selection.js';
import { addSfxChange } from '../timeline/timeline-changes.js';
import { TimelineCanvas } from '../timeline/TimelineCanvas.js';
import { trackLayout, type TimelineModel, type ToggleTrack } from '../timeline/timeline-model.js';
import {
  clampView,
  contentWidth,
  fitView,
  followTime,
  resizeView,
  timeToX,
  xToTime,
  zoomAround,
  ZOOM_STEP,
  type TimelineView,
} from '../timeline/timeline-view.js';
import type { TimelineEditing } from '../timeline/use-timeline-edits.js';
import { formatTime } from './timeline-scale.js';
import { GainField, SfxPicker, ToolButton, TrackMenu } from './TimelineTools.js';
import { usePref } from './ui-prefs.js';

export interface TimelinePanelProps {
  /** Shots, words and cues with pending edits applied. */
  readonly model: TimelineModel;
  /** Length of the timeline (s): the video or the content, whichever is longer. */
  readonly duration: number;
  readonly time: number;
  readonly playing: boolean;
  readonly fps: number;
  readonly selection: SelectionStore;
  readonly editing: TimelineEditing;
  readonly waveform: WaveformView;
  readonly onSeek: (t: number) => void;
  /** Ruler drags scrub (with audio snippets, PLAN.md#6.4). */
  readonly onScrub: (t: number) => void;
  /** A library sound dropped on the lanes at time `t` (PLAN.md#8.2). */
  readonly onDropSound: (sound: LibrarySound, t: number) => void;
  /** Locked shots: changing their length needs a confirmation. */
  readonly locked: ReadonlySet<string>;
}

const EMPTY_TEXT = {
  shots: 'No shots yet: run Storyboard',
  narration: 'No words yet: run Words timed',
  cues: 'No sound effects yet · double-click here to add one',
  cards: 'On-screen cards are not shown here yet',
  ambience: 'No ambience or music yet',
} as const;

const TRACKS_PREFS_KEY = 'reelforge.layout.timeline.v1';
const tracksPrefsSchema = z.object({
  hidden: z.array(z.enum(['shots', 'narration', 'cues', 'audio', 'cards', 'ambience'])),
});
const DEFAULT_TRACKS_PREFS: { hidden: ToggleTrack[] } = { hidden: [] };

function useLaneWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, width];
}

export function TimelinePanel(props: TimelinePanelProps): JSX.Element {
  const { model, duration, time, playing, selection, editing } = props;
  const [tracks, setTracks] = usePref(TRACKS_PREFS_KEY, tracksPrefsSchema, DEFAULT_TRACKS_PREFS);
  const hidden = useMemo(() => new Set(tracks.hidden), [tracks.hidden]);
  const layout = useMemo(() => trackLayout(hidden), [hidden]);
  const selected = useSelection(selection);
  const [laneRef, laneWidth] = useLaneWidth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<TimelineView>(() => fitView(duration, 1));
  const [picker, setPicker] = useState<{ t: number; x: number } | undefined>(undefined);
  const [lockedEdit, setLockedEdit] = useState<
    { readonly change: FileEdits; readonly ids: readonly string[] } | undefined
  >(undefined);
  const applyEdit = (change: FileEdits): void => {
    const ids = lockedLengthChanges(change, props.locked);
    if (ids.length > 0) setLockedEdit({ change, ids });
    else editing.apply(change);
  };

  useEffect(() => {
    if (laneWidth > 0) setView((current) => resizeView(current, duration, laneWidth));
  }, [duration, laneWidth]);

  useEffect(() => {
    if (playing) setView((current) => followTime(current, time));
  }, [playing, time]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller && Math.abs(scroller.scrollLeft - view.scrollX) > 1) {
      scroller.scrollLeft = view.scrollX;
    }
  }, [view.scrollX, view.pxPerSecond]);

  const updateView = (update: (current: TimelineView) => TimelineView): void => {
    setView((current) => clampView(update(current)));
  };
  const zoomBy = (factor: number): void => {
    const anchor = Math.min(Math.max(timeToX(view, time), 0), view.width);
    updateView((current) => zoomAround(current, factor, anchor));
  };
  const cues = selectedCues(selected);
  const [singleCue] = cues;

  return (
    <section className="panel timeline" aria-label="Timeline">
      {lockedEdit !== undefined && (
        <ConfirmDialog
          title="Change a locked shot?"
          confirmLabel="Change the length"
          confirmClass="primary"
          busy={false}
          onConfirm={() => {
            editing.apply(lockedEdit.change);
            setLockedEdit(undefined);
          }}
          onCancel={() => {
            setLockedEdit(undefined);
          }}
        >
          <p>{lockedLengthQuestion(lockedEdit.ids)}</p>
        </ConfirmDialog>
      )}
      <div className="timeline-toolbar" role="toolbar" aria-label="Timeline tools">
        <ToolButton
          label="Zoom out"
          keys="−"
          onClick={() => {
            zoomBy(1 / ZOOM_STEP);
          }}
        >
          −
        </ToolButton>
        <ToolButton
          label="Zoom in"
          keys="+"
          onClick={() => {
            zoomBy(ZOOM_STEP);
          }}
        >
          +
        </ToolButton>
        <ToolButton
          label="Fit to project"
          onClick={() => {
            setView(fitView(duration, laneWidth));
          }}
        >
          Fit
        </ToolButton>
        <span className="timeline-zoom mono" aria-label="Zoom">
          {view.pxPerSecond >= 10 ? Math.round(view.pxPerSecond) : view.pxPerSecond.toFixed(1)} px/s
        </span>
        <span className="toolbar-gap" />
        <TrackMenu
          hidden={hidden}
          onToggle={(track, shown) => {
            setTracks((current) => ({
              hidden: shown
                ? current.hidden.filter((id) => id !== track)
                : [...current.hidden.filter((id) => id !== track), track],
            }));
          }}
        />
        <ToolButton
          label="Undo timeline edit"
          keys="Ctrl+Z"
          disabled={!editing.canUndo}
          onClick={editing.undo}
        >
          Undo
        </ToolButton>
        <ToolButton
          label="Redo timeline edit"
          keys="Ctrl+Y"
          disabled={!editing.canRedo}
          onClick={editing.redo}
        >
          Redo
        </ToolButton>
        {cues.length === 1 && singleCue && (
          <GainField
            key={itemKey({ kind: 'cue', ...singleCue })}
            model={model}
            cue={singleCue}
            editing={editing}
          />
        )}
        <span
          className={`timeline-status${editing.status?.kind === 'error' ? ' error' : ''}`}
          role="status"
          title={editing.status?.text}
        >
          {editing.status?.text ?? 'Alt: drag without snapping · double-click Cues to add a sound'}
        </span>
      </div>
      <div className="timeline-body">
        <div className="timeline-labels" aria-hidden="true">
          {layout.rows.map((row) => (
            <span
              key={row.id}
              className={`track-label ${row.id}`}
              style={{ height: `${String(row.height)}px` }}
            >
              {row.id === 'ruler' ? (
                <span className="mono">{formatTime(time)}</span>
              ) : row.id === 'ambience' ? (
                <>
                  <span>Ambience</span>
                  <span className="sub">Music</span>
                </>
              ) : (
                row.label
              )}
            </span>
          ))}
        </div>
        <div
          className="timeline-lanes"
          ref={laneRef}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(SOUND_DRAG_TYPE)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={(event) => {
            const sound = decodeSoundDrag(event.dataTransfer.getData(SOUND_DRAG_TYPE));
            if (sound === null) return;
            event.preventDefault();
            const left = event.currentTarget.getBoundingClientRect().left;
            props.onDropSound(sound, Math.max(0, xToTime(view, event.clientX - left)));
          }}
        >
          {laneWidth > 0 && (
            <TimelineCanvas
              model={model}
              view={view}
              onView={updateView}
              time={time}
              fps={props.fps}
              selection={selection}
              selected={selected}
              waveform={props.waveform}
              emptyText={EMPTY_TEXT}
              layout={layout}
              onSeek={props.onSeek}
              onScrub={props.onScrub}
              onChange={applyEdit}
              onUndo={editing.undo}
              onRedo={editing.redo}
              onAddSfx={(t, x) => {
                setPicker({ t, x });
              }}
            />
          )}
          {picker && (
            <SfxPicker
              x={picker.x}
              onClose={() => {
                setPicker(undefined);
              }}
              onPick={(name) => {
                editing.apply(addSfxChange(model.cues, picker.t, name));
                selection.set([{ kind: 'cue', track: 'sfx', index: model.cues.sfx.length }]);
                setPicker(undefined);
              }}
            />
          )}
          <div
            className="timeline-scrollbar"
            ref={scrollRef}
            aria-hidden="true"
            onScroll={(event) => {
              const scrollX = event.currentTarget.scrollLeft;
              setView((current) =>
                Math.abs(current.scrollX - scrollX) > 1
                  ? clampView({ ...current, scrollX })
                  : current,
              );
            }}
          >
            <div style={{ width: `${String(contentWidth(view))}px` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
