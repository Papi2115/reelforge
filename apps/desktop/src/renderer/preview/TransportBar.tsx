/**
 * Transport under the preview (PLAN.md#6.4): play/pause, time, scrub slider (with audio
 * snippets), speed, loop, mute, frame snapshot and the fps overlay toggle.
 */
import type { JSX } from 'react';
import { CameraIcon, LoopIcon, PauseIcon, PlayIcon, SpeakerIcon } from '../layout/icons.js';
import { formatTime } from '../layout/timeline-scale.js';
import { PLAYBACK_RATES, type Player, type PlayerState } from './player.js';
import { SNAPSHOT_SCALES, type SnapshotScale } from './snapshot.js';

export interface TransportBarProps {
  readonly player: Player;
  readonly state: PlayerState;
  readonly ready: boolean;
  /** Snapshots need an open project (they are saved into it). */
  readonly snapshots: boolean;
  readonly snapshotScale: SnapshotScale;
  readonly onSnapshotScale: (scale: SnapshotScale) => void;
  readonly onSnapshot: () => void;
  readonly statsVisible: boolean;
  readonly onToggleStats: () => void;
}

export function TransportBar(props: TransportBarProps): JSX.Element {
  const { player, state, ready } = props;
  return (
    <div className="transport" role="toolbar" aria-label="Transport">
      <button
        type="button"
        className="icon-button"
        aria-label={state.playing ? 'Pause' : 'Play'}
        title={state.playing ? 'Pause (Space)' : 'Play (Space)'}
        disabled={!ready}
        onClick={() => {
          player.toggle();
        }}
      >
        {state.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <span className="transport-time mono" aria-label="Current time">
        {formatTime(state.time)} <span className="muted">/ {formatTime(state.duration)}</span>
      </span>
      <input
        type="range"
        className="transport-scrub"
        aria-label="Scrub"
        min={0}
        max={state.duration}
        step={1 / state.fps}
        value={state.time}
        disabled={!ready}
        onChange={(event) => {
          player.scrub(Number(event.target.value));
        }}
      />
      <label className="transport-select" title="Playback speed (J / L)">
        <span className="visually-hidden">Playback speed</span>
        <select
          value={state.rate}
          onChange={(event) => {
            player.setRate(Number(event.target.value));
          }}
        >
          {PLAYBACK_RATES.map((rate) => (
            <option key={rate} value={rate}>
              {rate}×
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="icon-button"
        aria-label="Loop"
        aria-pressed={state.loop}
        title="Loop playback"
        onClick={() => {
          player.setLoop(!state.loop);
        }}
      >
        <LoopIcon />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Mute"
        aria-pressed={state.muted}
        title={state.clock === 'audio' ? 'Mute (M)' : 'Mute (M) · no project audio yet'}
        onClick={() => {
          player.setMuted(!state.muted);
        }}
      >
        <SpeakerIcon muted={state.muted} />
      </button>
      {props.snapshots && (
        <>
          <button
            type="button"
            className="icon-button"
            aria-label="Snapshot frame"
            title="Save this frame as PNG into out/snapshots"
            disabled={!ready}
            onClick={props.onSnapshot}
          >
            <CameraIcon />
          </button>
          <label className="transport-select" title="Snapshot size">
            <span className="visually-hidden">Snapshot size</span>
            <select
              value={props.snapshotScale}
              onChange={(event) => {
                const scale = SNAPSHOT_SCALES.find((option) => option.value === event.target.value);
                if (scale) props.onSnapshotScale(scale.value);
              }}
            >
              {SNAPSHOT_SCALES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <button
        type="button"
        className="text-button transport-stats"
        aria-pressed={props.statsVisible}
        title="Show playback fps and frame times"
        onClick={props.onToggleStats}
      >
        FPS
      </button>
    </div>
  );
}
