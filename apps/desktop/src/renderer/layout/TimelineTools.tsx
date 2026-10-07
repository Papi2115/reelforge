/**
 * Pieces of the timeline toolbar (PLAN.md#6.5, #11.2): the gain field of the selected cue, the
 * sound picker of the Cues track, an icon/text tool button and the "Tracks" menu that shows or
 * hides rows.
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { BUILTIN_SFX_NAMES } from '../../shared/timeline-contract.js';
import { gainChange, type CueRef } from '../timeline/timeline-changes.js';
import { TOGGLE_TRACKS, type TimelineModel, type ToggleTrack } from '../timeline/timeline-model.js';
import type { TimelineEditing } from '../timeline/use-timeline-edits.js';

export function TrackMenu(props: {
  readonly hidden: ReadonlySet<ToggleTrack>;
  readonly onToggle: (track: ToggleTrack, shown: boolean) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target) !== true) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);
  const shown = TOGGLE_TRACKS.length - props.hidden.size;
  return (
    <div
      className="track-menu"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
      }}
    >
      <button
        type="button"
        className="tool-button track-menu-button"
        aria-haspopup="true"
        aria-expanded={open}
        title="Show or hide timeline tracks"
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        Tracks {shown}/{TOGGLE_TRACKS.length}
      </button>
      {open && (
        <fieldset className="track-menu-list">
          <legend className="visually-hidden">Timeline tracks</legend>
          {TOGGLE_TRACKS.map((track) => (
            <label key={track.id} className="track-menu-item">
              <input
                type="checkbox"
                checked={!props.hidden.has(track.id)}
                onChange={(event) => {
                  props.onToggle(track.id, event.target.checked);
                }}
              />
              {track.label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

export function GainField({
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

export function SfxPicker({
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

export function ToolButton(props: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  /** Keyboard shortcut, shown in the tooltip. */
  readonly keys?: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      className="tool-button"
      aria-label={props.label}
      title={props.keys === undefined ? props.label : `${props.label} (${props.keys})`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
