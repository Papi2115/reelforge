/**
 * Preview: the engine runs in its sandboxed iframe (ADR-004), frames come back over postMessage
 * and are drawn 1:1 into a 2D canvas, upscaled by an integer factor with nearest-neighbour
 * sampling (D3). The Player (PLAN.md#6.4) owns time: its master clock (project audio, else the
 * system clock) decides which frame is requested. When the project's files change, only what
 * changed is reloaded (hot reload of single shots); a broken scene keeps the last working frame.
 */
import { createSandboxedHarness, type LoadInfo, type PickInfo } from '@reelforge/engine';
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { ENGINE_ASSET_DIR, ENGINE_FRAME_HTML } from '../../shared/engine-assets.js';
import { errorMessage, rendererLog } from '../log.js';
import { integerDisplaySize, type DisplaySize } from './integer-scale.js';
import type { Player } from './player.js';
import { playerNeedsVideo, PreviewController, type FrameSink } from './preview-controller.js';
import {
  AudioProblemNotice,
  EmptyStage,
  ReloadNotice,
  SnapshotNotice,
  StatsOverlay,
  type ReloadStatus,
} from './PreviewOverlays.js';
import { resolvePreview, type PreviewSource } from './preview-source.js';
import type { SnapshotScale } from './snapshot.js';
import { TransportBar } from './TransportBar.js';
import { usePlayerState, useTransportKeys } from './use-player.js';
import { useSnapshots } from './use-snapshot.js';

const log = rendererLog('preview');
/** How long "Reloaded s03 (…)" stays up. */
const RELOAD_NOTICE_MS = 4000;
/** Preview watchdog (PreviewController): a load / scene rebuild, and any other engine call. */
const PREVIEW_TIMEOUTS = { loadMs: 120_000, callMs: 20_000 } as const;

type PreviewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  /** A project without a video yet: the empty-stage card, no frame (never the demo). */
  | { readonly status: 'empty'; readonly problem: string | undefined }
  | { readonly status: 'ready'; readonly info: LoadInfo; readonly note: string | undefined };

function canvasSink(canvas: HTMLCanvasElement, player: Player): FrameSink {
  let first = true;
  return {
    draw(frame, width, height, t, renderMs) {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context unavailable');
      const pixels = new Uint8ClampedArray(frame.buffer, frame.byteOffset, frame.byteLength);
      context.putImageData(new ImageData(pixels, width, height), 0, 0);
      // Read by the smoke test (test/app.smoke.test.ts) and snapshots: the frame on screen.
      canvas.dataset['renderedT'] = t.toFixed(3);
      player.frameDrawn(t, renderMs);
      if (first) {
        first = false;
        log.info(`first frame rendered at t=${t.toFixed(3)}`);
      }
    },
  };
}

function engineFrameUrl(): string {
  return new URL(`${ENGINE_ASSET_DIR}/${ENGINE_FRAME_HTML}`, document.baseURI).href;
}

function sourceKey(source: PreviewSource): string {
  if (source.kind === 'demo') return 'demo';
  const variant = source.kind === 'variant' ? `:${source.shotId}:${source.key}` : '';
  return `project:${String(source.revision)}${variant}`;
}

/** A point of the frame to mark (the object picked for the chat), normalized 0..1. */
export interface PreviewMarker {
  readonly x: number;
  readonly y: number;
  readonly label: string;
}

export interface PreviewPanelProps {
  readonly source: PreviewSource;
  readonly player: Player;
  /** Frame snapshots are saved into the open project, so they are offered only with one. */
  readonly snapshots: boolean;
  /**
   * Click-to-select (PLAN.md#6.6): a click on the frame asks the engine what is there at the
   * current time; null = background. (x, y) is the clicked point, normalized 0..1.
   */
  readonly onPick?: (pick: PickInfo | null, x: number, y: number) => void;
  readonly marker?: PreviewMarker | null;
  /** Docked under the transport (the live co-direction command bar, PLAN.md#12.14). */
  readonly footer?: ReactNode;
  /** The next action the empty stage suggests (a project without a video yet). */
  readonly emptyHint?: string | undefined;
}

export function PreviewPanel({
  source,
  player,
  snapshots,
  onPick,
  marker,
  footer,
  emptyHint,
}: PreviewPanelProps): JSX.Element {
  const frameHostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** True once a frame of a loaded video is on screen: later failures keep it visible. */
  const readyRef = useRef(false);
  const playerState = usePlayerState(player);
  const [controller, setController] = useState<PreviewController | undefined>(undefined);
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [display, setDisplay] = useState<DisplaySize | undefined>(undefined);
  const [reload, setReload] = useState<ReloadStatus | undefined>(undefined);
  const [statsVisible, setStatsVisible] = useState(false);
  const [snapshotScale, setSnapshotScale] = useState<SnapshotScale>('native');
  const snapshot = useSnapshots(canvasRef, (t) => controller?.shotAt(t));
  useTransportKeys(player);

  useEffect(() => {
    const host = frameHostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    // One container per harness, removed on cleanup together with its iframe.
    const container = document.createElement('div');
    host.appendChild(container);
    let disposed = false;
    const fail = (error: unknown): void => {
      if (disposed) return;
      const message = errorMessage(error);
      log.error(message);
      player.pause();
      if (readyRef.current) setReload({ kind: 'failed', message });
      else setState({ status: 'error', message });
    };
    const harness = createSandboxedHarness({
      frameUrl: engineFrameUrl(),
      container,
      lintScenes: true,
      timeouts: PREVIEW_TIMEOUTS,
    });
    const watchdog = {
      restart: () => {
        harness.restart();
      },
      notify: (text: string) => {
        if (disposed) return;
        log.warn(text);
        setReload({ kind: 'reloaded', text });
      },
    };
    const next = new PreviewController(
      harness,
      canvasSink(canvas, player),
      fail,
      () => performance.now(),
      watchdog,
    );
    player.attachTarget(next);
    setController(next);
    return () => {
      disposed = true;
      player.attachTarget(undefined);
      setController(undefined);
      container.remove();
    };
  }, [player]);

  const key = sourceKey(source);
  useEffect(() => {
    if (!controller) return;
    let stale = false;
    // A function, so the check after each await is not narrowed away.
    const isStale = (): boolean => stale;
    const started = performance.now();
    const show = async (): Promise<void> => {
      const resolved = await resolvePreview(source, window.reelforge);
      if (isStale()) return;
      if (resolved.kind === 'empty') {
        // A video was on screen: keep its last frame and say why it cannot update.
        if (readyRef.current && resolved.problem !== undefined) {
          setReload({ kind: 'failed', message: resolved.problem });
        } else {
          player.pause();
          setState({ status: 'empty', problem: resolved.problem });
        }
        return;
      }
      const { manifest, note } = resolved;
      const result = await controller.apply(manifest);
      if (isStale()) return;
      const { info } = result;
      if (result.kind === 'loaded') {
        log.info(
          `loaded ${key}: ${String(info.duration)} s, ${String(info.width)}x${String(info.height)} @ ${String(info.fps)} fps, style ${info.style}, GPU ${info.gpu.renderer}`,
        );
      }
      if (playerNeedsVideo(result, player.getState())) player.setVideo(info.duration, info.fps);
      setState({ status: 'ready', info, note });
      await controller.refresh(player.getState().time);
      if (isStale()) return;
      readyRef.current = true;
      if (result.kind === 'reloaded') {
        const ms = Math.round(performance.now() - started);
        const shots = result.shotIds.join(', ');
        log.info(`hot reload of ${shots}: ${String(ms)} ms`);
        setReload({ kind: 'reloaded', text: `Reloaded ${shots} (${String(ms)} ms)` });
      } else {
        setReload(undefined);
      }
    };
    show().catch((error: unknown) => {
      if (isStale()) return;
      const message = errorMessage(error);
      log.error(`preview of ${key} failed: ${message}`);
      if (readyRef.current) setReload({ kind: 'failed', message });
      else setState({ status: 'error', message });
    });
    return () => {
      stale = true;
    };
    // `source` is identified by its key: a new object with the same key is the same video.
  }, [controller, key, player]);

  useEffect(() => {
    if (reload?.kind !== 'reloaded') return;
    const timer = window.setTimeout(() => {
      setReload(undefined);
    }, RELOAD_NOTICE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [reload]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || state.status !== 'ready') return;
    const { width, height } = state.info;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width: cssWidth, height: cssHeight } = entry.contentRect;
      setDisplay(integerDisplaySize(cssWidth, cssHeight, width, height, window.devicePixelRatio));
    });
    observer.observe(stage);
    return () => {
      observer.disconnect();
    };
  }, [state]);

  const note = state.status === 'ready' ? state.note : undefined;
  return (
    <section
      className="preview"
      aria-label="Preview"
      data-clock={playerState.clock}
      data-playing={String(playerState.playing)}
    >
      <div className="preview-stage" ref={stageRef}>
        <div className="preview-canvas-wrap" hidden={state.status === 'empty'}>
          <canvas
            ref={canvasRef}
            className={`preview-canvas${onPick ? ' pickable' : ''}`}
            style={display ? { width: display.cssWidth, height: display.cssHeight } : undefined}
            title={onPick ? 'Click an object to select it for Claude' : undefined}
            onClick={(event) => {
              if (!onPick || !controller || state.status !== 'ready') return;
              const rect = event.currentTarget.getBoundingClientRect();
              if (rect.width === 0 || rect.height === 0) return;
              const x = (event.clientX - rect.left) / rect.width;
              const y = (event.clientY - rect.top) / rect.height;
              controller.pick(x, y, player.getState().time).then(
                (picked) => {
                  onPick(picked, x, y);
                },
                (error: unknown) => {
                  log.warn(`pick failed: ${errorMessage(error)}`);
                },
              );
            }}
          />
          {marker && (
            <span
              className="preview-marker"
              style={{ left: `${String(marker.x * 100)}%`, top: `${String(marker.y * 100)}%` }}
              title={marker.label}
              aria-hidden="true"
            />
          )}
        </div>
        {state.status === 'loading' && <p className="preview-status">Loading engine…</p>}
        {state.status === 'empty' && <EmptyStage hint={emptyHint} problem={state.problem} />}
        {state.status === 'error' && (
          <p className="preview-status preview-error" role="alert">
            {state.message}
          </p>
        )}
        {note !== undefined && (
          <p className="preview-note" role="status">
            {note}
          </p>
        )}
        {statsVisible && <StatsOverlay player={player} clock={playerState.clock} />}
        {playerState.audioProblem !== null && (
          <AudioProblemNotice
            message={playerState.audioProblem}
            onDismiss={() => {
              player.dismissAudioProblem();
            }}
          />
        )}
        {reload && (
          <ReloadNotice
            status={reload}
            onDismiss={() => {
              setReload(undefined);
            }}
          />
        )}
        {snapshot.notice && (
          <SnapshotNotice
            notice={snapshot.notice}
            onCopy={snapshot.copy}
            onDismiss={snapshot.dismiss}
          />
        )}
      </div>
      <TransportBar
        player={player}
        state={playerState}
        ready={state.status === 'ready'}
        snapshots={snapshots}
        snapshotScale={snapshotScale}
        onSnapshotScale={setSnapshotScale}
        onSnapshot={() => {
          snapshot.take(snapshotScale);
        }}
        statsVisible={statsVisible}
        onToggleStats={() => {
          setStatsVisible((visible) => !visible);
          player.resetFrameStats();
        }}
      />
      {footer}
      <div ref={frameHostRef} className="preview-engine-host" />
    </section>
  );
}
