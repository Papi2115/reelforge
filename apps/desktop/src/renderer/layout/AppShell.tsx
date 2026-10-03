/**
 * Main layout grid (PLAN.md#6.3, #11.2): left column (pipeline + shots, full height), centre
 * (preview), right column (Claude chat, full height; a slim rail when collapsed) and the timeline
 * under the preview. The splitters resize the panes; sizes are clamped to the window and persisted in
 * localStorage.
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import { errorMessage, rendererLog } from '../log.js';
import {
  clampPaneSizes,
  PANE_LIMITS,
  PANE_SIZES_STORAGE_KEY,
  parseStoredPaneSizes,
  serializePaneSizes,
  type PaneSizes,
  type Viewport,
} from './pane-sizes.js';
import { Splitter } from './Splitter.js';

const log = rendererLog('layout');

function loadPaneSizes(): PaneSizes {
  try {
    return parseStoredPaneSizes(window.localStorage.getItem(PANE_SIZES_STORAGE_KEY));
  } catch (error) {
    log.warn(`pane sizes not readable, using defaults: ${errorMessage(error)}`);
    return parseStoredPaneSizes(null);
  }
}

function savePaneSizes(sizes: PaneSizes): void {
  try {
    window.localStorage.setItem(PANE_SIZES_STORAGE_KEY, serializePaneSizes(sizes));
  } catch (error) {
    log.warn(`pane sizes not saved: ${errorMessage(error)}`);
  }
}

export interface AppShellProps {
  readonly left: ReactNode;
  readonly center: ReactNode;
  readonly right: ReactNode;
  readonly bottom: ReactNode;
  /** Width of the collapsed chat rail; undefined while the chat is open. */
  readonly collapsedRight?: number | undefined;
}

export function AppShell({
  left,
  center,
  right,
  bottom,
  collapsedRight,
}: AppShellProps): JSX.Element {
  const shellRef = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState<PaneSizes>(loadPaneSizes);
  const [viewport, setViewport] = useState<Viewport | undefined>(undefined);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(shell);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    savePaneSizes(requested);
  }, [requested]);

  const sizes = viewport ? clampPaneSizes(requested, viewport, collapsedRight) : requested;
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;
  const splitters = 2 * PANE_LIMITS.splitterSize;
  const rightWidth = collapsedRight ?? sizes.right;
  const rightSplitter = collapsedRight === undefined ? PANE_LIMITS.splitterSize : 0;
  // A drag stores the clamped size, so later window growth does not resurrect a stale value.
  const resize = (patch: Partial<PaneSizes>): void => {
    const next = { ...sizes, ...patch };
    setRequested(viewport ? clampPaneSizes(next, viewport, collapsedRight) : next);
  };

  return (
    <div
      ref={shellRef}
      className="app-shell"
      style={{
        gridTemplateColumns: `${String(sizes.left)}px ${String(PANE_LIMITS.splitterSize)}px minmax(0, 1fr) ${String(rightSplitter)}px ${String(rightWidth)}px`,
        gridTemplateRows: `minmax(0, 1fr) ${String(PANE_LIMITS.splitterSize)}px ${String(sizes.bottom)}px`,
      }}
    >
      <div className="shell-left">{left}</div>
      <Splitter
        className="shell-split-left"
        label="Resize left panel"
        orientation="vertical"
        value={sizes.left}
        min={PANE_LIMITS.minLeft}
        max={width - rightWidth - splitters - PANE_LIMITS.minCenterWidth}
        growsTowardsStart={false}
        onChange={(value) => {
          resize({ left: value });
        }}
      />
      <div className="shell-center">{center}</div>
      {collapsedRight === undefined && (
        <Splitter
          className="shell-split-right"
          label="Resize chat panel"
          orientation="vertical"
          value={sizes.right}
          min={PANE_LIMITS.minRight}
          max={width - sizes.left - splitters - PANE_LIMITS.minCenterWidth}
          growsTowardsStart
          onChange={(value) => {
            resize({ right: value });
          }}
        />
      )}
      <div className="shell-right">{right}</div>
      <Splitter
        className="shell-split-bottom"
        label="Resize timeline"
        orientation="horizontal"
        value={sizes.bottom}
        min={PANE_LIMITS.minBottom}
        max={height - PANE_LIMITS.splitterSize - PANE_LIMITS.minCenterHeight}
        growsTowardsStart
        onChange={(value) => {
          resize({ bottom: value });
        }}
      />
      <div className="shell-bottom">{bottom}</div>
    </div>
  );
}
