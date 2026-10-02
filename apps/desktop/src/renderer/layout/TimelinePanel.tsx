/**
 * Timeline (PLAN.md#6.5): toolbar (zoom, fit, undo/redo, gain of the selected cue, save status),
 * track labels, the canvas lanes (timeline/TimelineCanvas.tsx) with a horizontal scrollbar, and
 * the sound picker opened by double-clicking the Cues track. The playhead follows the player;
 * clicks and ruler drags seek / scrub through the player API.
 */
import { useEffect, useRef, useState, type JSX, type ReactNode, type RefObject } from 'react';
import { BUILTIN_SFX_NAMES } from '../../shared/timeline-contract.js';
import type { WaveformView } from '../timeline/draw-timeline.js';
import { itemKey, selectedCues, useSelection, type SelectionStore } from '../timeline/selection.js';
import { addSfxChange, gainChange, type CueRef } from '../timeline/timeline-changes.js';
import { TimelineCanvas } from '../timeline/TimelineCanvas.js';
import { TRACK_ROWS, type TimelineModel } from '../timeline/timeline-model.js';
import {
  clampView,
  contentWidth,
  fitView,
  followTime,
  resizeView,
  timeToX,
  zoomAround,
  ZOOM_STEP,
  type TimelineView,
} from '../timeline/timeline-view.js';
import type { TimelineEditing } from '../timeline/use-timeline-edits.js';
import { formatTime } from './timeline-scale.js';

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
}

const EMPTY_TEXT = {
  shots: 'No storyboard yet',
  narration: 'Words appear after the Words timed stage',
  cues: 'No sound effects yet · double-click to add one',
  cards: 'On-screen cards are not shown here yet',
  ambience: 'No ambience or music yet',
} as const;

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

function GainField({
  model,
  cue,
  editing,
}: {
  readonly model: TimelineModel;
  readonly cue: CueRef;
  readonly editing: TimelineEditing;
}): JSX.Element | null {
  const current = model.cues[cue.track][cue.index]?.gainDb;
  const [text, setText] = useState(current === undefined ? '' : String(current));
  useEffect(() => {
    setText(current === undefined ? '' : String(current));
  }, [current]);
  if (current === undefined) return null;
  const commit = (): void => {
    const change = gainChange(model.cues, cue, Number(text));
    if (change) editing.apply(change);
    else setText(String(current));
  };
  return (
    <label className="timeline-gain">
      Gain
      <input
        type="number"
        step={0.5}
        min={-60}
        max={24}
        value={text}
        aria-label={`Gain of the selected ${cue.track} cue (dB)`}
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
      dB
    </label>
  );
}

function SfxPicker({
  x,
  onPick,
  onClose,
}: {
  readonly x: number;
  readonly onPick: (name: string) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
  }, []);
  return (
    <div
      ref={ref}
      className="sfx-picker"
      role="dialog"
      aria-label="Add a sound effect"
      style={{ left: `${String(Math.max(0, x - 8))}px` }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        event.stopPropagation();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onClose();
      }}
    >
      {BUILTIN_SFX_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => {
            onPick(name);
          }}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function ToolButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

export function TimelinePanel(props: TimelinePanelProps): JSX.Element {
  const { model, duration, time, playing, selection, editing } = props;
  const selected = useSelection(selection);
  const [laneRef, laneWidth] = useLaneWidth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<TimelineView>(() => fitView(duration, 1));
  const [picker, setPicker] = useState<{ t: number; x: number } | undefined>(undefined);

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
      <div className="timeline-toolbar" role="toolbar" aria-label="Timeline tools">
        <ToolButton
          label="Zoom out"
          onClick={() => {
            zoomBy(1 / ZOOM_STEP);
          }}
        >
          −
        </ToolButton>
        <ToolButton
          label="Zoom in"
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
        <ToolButton label="Undo timeline edit" disabled={!editing.canUndo} onClick={editing.undo}>
          Undo
        </ToolButton>
        <ToolButton label="Redo timeline edit" disabled={!editing.canRedo} onClick={editing.redo}>
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
          {TRACK_ROWS.map((row) => (
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
        <div className="timeline-lanes" ref={laneRef}>
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
              onSeek={props.onSeek}
              onScrub={props.onScrub}
              onChange={editing.apply}
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
