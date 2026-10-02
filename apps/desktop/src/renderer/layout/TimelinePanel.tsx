/**
 * Timeline skeleton (PLAN.md#6.3): time ruler, the six tracks and a playhead bound to the
 * preview time; dragging on the ruler scrubs (PLAN.md#6.4). Shows what the project already has
 * (shots, timed words, cues) read-only; zoom, selection and editing arrive in PLAN.md#6.5.
 */
import type { StoryboardShot, TimedWord } from '@reelforge/shared';
import {
  useEffect,
  useRef,
  useState,
  type DOMAttributes,
  type JSX,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { CuesView } from '../../shared/snapshot-contract.js';
import {
  formatRulerLabel,
  formatTime,
  rulerTicks,
  timeAtPosition,
  timePercent,
} from './timeline-scale.js';

export interface TimelinePanelProps {
  readonly duration: number;
  readonly time: number;
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly TimedWord[];
  readonly cues: CuesView | undefined;
  /** Voice-over file name when the project has one. */
  readonly voiceover: string | undefined;
  readonly selectedShotId: string | undefined;
  /** Dragging on the ruler scrubs (with audio snippets, PLAN.md#6.4). */
  readonly onScrub: (t: number) => void;
}

/** Pointer handlers that scrub while the ruler is pressed (pointer capture keeps the drag). */
function rulerScrubHandlers(
  duration: number,
  onScrub: (t: number) => void,
): Pick<DOMAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp'> {
  const scrubAt = (event: PointerEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    onScrub(timeAtPosition(event.clientX - rect.left, rect.width, duration));
  };
  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      scrubAt(event);
    },
    onPointerMove: (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) scrubAt(event);
    },
    onPointerUp: (event) => {
      event.currentTarget.releasePointerCapture(event.pointerId);
    },
  };
}

interface Segment {
  readonly key: string;
  readonly from: number;
  readonly to: number;
  readonly label: string;
  readonly selected?: boolean;
  /** A point in time (sound effect): fixed-width marker, label in the tooltip. */
  readonly marker?: boolean;
}

function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, width];
}

function Segments({
  items,
  duration,
}: {
  readonly items: readonly Segment[];
  readonly duration: number;
}): JSX.Element {
  return (
    <>
      {items.map((item) => {
        const left = timePercent(item.from, duration);
        const width = Math.max(timePercent(item.to, duration) - left, 0);
        if (item.marker) {
          return (
            <span
              key={item.key}
              className="segment marker"
              style={{ left: `${String(left)}%` }}
              title={`${item.label} · ${formatTime(item.from)}`}
            >
              <span className="visually-hidden">{item.label}</span>
            </span>
          );
        }
        return (
          <span
            key={item.key}
            className={`segment${item.selected ? ' selected' : ''}`}
            style={{ left: `${String(left)}%`, width: `${String(width)}%` }}
            title={`${item.label} · ${formatTime(item.from)}–${formatTime(item.to)}`}
          >
            {item.label}
          </span>
        );
      })}
    </>
  );
}

function Track({
  label,
  children,
  empty,
}: {
  readonly label: string;
  readonly children?: ReactNode;
  readonly empty: string;
}): JSX.Element {
  return (
    <div className="track" role="row" aria-label={label}>
      <span className="track-label" role="rowheader">
        {label}
      </span>
      <span className="track-lane" role="cell">
        {children ?? <span className="track-empty">{empty}</span>}
      </span>
    </div>
  );
}

export function TimelinePanel(props: TimelinePanelProps): JSX.Element {
  const { duration, time, shots, words, cues, voiceover } = props;
  const [rulerRef, rulerWidth] = useElementWidth<HTMLDivElement>();
  const ticks = rulerTicks(duration, rulerWidth);
  const shotSegments = shots.map((shot) => ({
    key: shot.id,
    from: shot.t0,
    to: shot.t1,
    label: shot.id,
    selected: shot.id === props.selectedShotId,
  }));
  const wordSegments = words.map((word, index) => ({
    key: String(index),
    from: word.t,
    to: word.tEnd,
    label: word.text,
  }));
  const sfx = cues?.sfx.map((cue, index) => ({
    key: String(index),
    from: cue.t,
    to: cue.t,
    label: cue.label,
    marker: true,
  }));
  const music = cues?.music.map((cue, index) => ({ key: `m${String(index)}`, ...cue }));
  const ambience = cues?.ambience.map((cue, index) => ({ key: String(index), ...cue }));
  const audio = [
    ...(voiceover === undefined ? [] : [{ key: 'vo', from: 0, to: duration, label: voiceover }]),
    ...(music ?? []),
  ];
  const playhead = `${String(timePercent(time, duration))}%`;
  const segments = (items: readonly Segment[] | undefined): ReactNode =>
    items && items.length > 0 ? <Segments items={items} duration={duration} /> : undefined;

  return (
    <section className="panel timeline" aria-label="Timeline">
      <div className="timeline-grid" role="table" aria-label="Tracks">
        <div className="track ruler-row" role="row">
          <span className="track-label mono" role="rowheader">
            {formatTime(time)}
          </span>
          <div
            className="ruler"
            ref={rulerRef}
            role="cell"
            aria-hidden="true"
            title="Drag to scrub"
            {...rulerScrubHandlers(duration, props.onScrub)}
          >
            {ticks.map((tick) => (
              <span
                key={tick}
                className="tick"
                style={{ left: `${String(timePercent(tick, duration))}%` }}
              >
                {formatRulerLabel(tick)}
              </span>
            ))}
          </div>
        </div>
        <Track label="Shots" empty="No storyboard yet">
          {segments(shotSegments)}
        </Track>
        <Track label="Narration" empty="Words appear after the Words timed stage">
          {segments(wordSegments)}
        </Track>
        <Track label="Cues" empty="No sound effects yet">
          {segments(sfx)}
        </Track>
        <Track label="Audio" empty="No voiceover yet">
          {segments(audio)}
        </Track>
        <Track label="Cards" empty="On-screen cards arrive with the timeline editor" />
        <Track label="Ambience" empty="No ambience yet">
          {segments(ambience)}
        </Track>
        <div className="playhead-layer" aria-hidden="true">
          <span className="playhead" data-testid="playhead" style={{ left: playhead }} />
        </div>
      </div>
    </section>
  );
}
