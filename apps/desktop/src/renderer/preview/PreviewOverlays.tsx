/**
 * Overlays over the preview frame (PLAN.md#6.4): the fps debug readout, the hot-reload status /
 * engine error list (the last working frame stays visible underneath), the preview audio warning
 * and the snapshot notice.
 */
import { useEffect, useState, type JSX } from 'react';
import type { SnapshotSaveResult } from '../../shared/player-contract.js';
import type { FrameStatsSnapshot } from './frame-stats.js';
import type { Player } from './player.js';

const STATS_REFRESH_MS = 250;

export function StatsOverlay({
  player,
  clock,
}: {
  readonly player: Player;
  readonly clock: string;
}): JSX.Element {
  const [stats, setStats] = useState<FrameStatsSnapshot>(() => player.frameStats());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setStats(player.frameStats());
    }, STATS_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [player]);
  const capacity = stats.renderMs > 0 ? Math.round(1000 / stats.renderMs) : 0;
  return (
    <p
      className="preview-stats mono"
      data-testid="preview-stats"
      data-fps={stats.fps}
      data-dropped={stats.dropped}
      data-render-ms={stats.renderMs.toFixed(2)}
    >
      {stats.fps} fps · {stats.dropped} dropped · {stats.renderMs.toFixed(1)} ms/frame (≈
      {capacity} fps max) · clock {clock}
    </p>
  );
}

export type ReloadStatus =
  | { readonly kind: 'reloaded'; readonly text: string }
  | { readonly kind: 'failed'; readonly message: string };

export function ReloadNotice({
  status,
  onDismiss,
}: {
  readonly status: ReloadStatus;
  readonly onDismiss: () => void;
}): JSX.Element {
  if (status.kind === 'reloaded') {
    return (
      <p className="preview-reload" role="status" data-testid="preview-reload">
        {status.text}
      </p>
    );
  }
  return (
    <div className="preview-problem" role="alert" data-testid="preview-problem">
      <div className="preview-problem-head">
        <strong>Scene error · showing the last working frame</strong>
        <button type="button" className="link-button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <pre>{status.message}</pre>
    </div>
  );
}

/** Why the preview has no (more) sound (PLAN.md#11.1): never silent without saying so. */
export function AudioProblemNotice({
  message,
  onDismiss,
}: {
  readonly message: string;
  readonly onDismiss: () => void;
}): JSX.Element {
  return (
    <p className="preview-audio-problem" role="alert" data-testid="preview-audio-problem">
      <span>{message}</span>
      <button
        type="button"
        className="link-button"
        aria-label="Dismiss audio warning"
        onClick={onDismiss}
      >
        ×
      </button>
    </p>
  );
}

export interface SnapshotNoticeState {
  readonly result: SnapshotSaveResult;
  readonly png: Uint8Array;
  readonly copied?: 'copied' | 'failed';
}

export function SnapshotNotice({
  notice,
  onCopy,
  onDismiss,
}: {
  readonly notice: SnapshotNoticeState;
  readonly onCopy: () => void;
  readonly onDismiss: () => void;
}): JSX.Element {
  const { result } = notice;
  return (
    <div className="preview-snapshot" role="status" data-testid="preview-snapshot">
      {result.status === 'saved' ? (
        <span title={result.path}>Saved {result.relative}</span>
      ) : (
        <span className="preview-error">Snapshot failed: {result.message}</span>
      )}
      {result.status === 'saved' && (
        <button type="button" className="link-button" onClick={onCopy}>
          {notice.copied === 'copied' ? 'Copied' : 'Copy to clipboard'}
        </button>
      )}
      {notice.copied === 'failed' && <span className="preview-error">Copy failed</span>}
      <button
        type="button"
        className="link-button"
        aria-label="Dismiss snapshot notice"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
