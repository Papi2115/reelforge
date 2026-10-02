/**
 * Snapshot actions of the preview (PLAN.md#6.4): encodes the frame on screen, has main save it
 * into `<project>/out/snapshots/` and offers copying the same PNG to the clipboard.
 */
import { useState, type RefObject } from 'react';
import { errorMessage, rendererLog } from '../log.js';
import type { SnapshotNoticeState } from './PreviewOverlays.js';
import { encodeSnapshot, snapshotShotId, type SnapshotScale } from './snapshot.js';

const log = rendererLog('snapshot');

export interface Snapshots {
  readonly notice: SnapshotNoticeState | undefined;
  readonly take: (scale: SnapshotScale) => void;
  readonly copy: () => void;
  readonly dismiss: () => void;
}

export function useSnapshots(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  shotAt: (t: number) => string | undefined,
): Snapshots {
  const [notice, setNotice] = useState<SnapshotNoticeState | undefined>(undefined);

  const take = (scale: SnapshotScale): void => {
    const canvas = canvasRef.current;
    const rendered = canvas?.dataset['renderedT'];
    if (!canvas || rendered === undefined) return;
    const t = Number(rendered);
    const shotId = snapshotShotId(shotAt(t));
    encodeSnapshot(canvas, scale)
      .then(async (png) => {
        const result = await window.reelforge.saveSnapshot({
          png,
          t,
          ...(shotId === undefined ? {} : { shotId }),
        });
        if (result.status === 'error') log.warn(`snapshot not saved: ${result.message}`);
        setNotice({ result, png });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        log.error(`snapshot failed: ${message}`);
        setNotice({ result: { status: 'error', message }, png: new Uint8Array() });
      });
  };

  const copy = (): void => {
    if (!notice) return;
    const current = notice;
    window.reelforge.copySnapshot(current.png).then(
      (result) => {
        if (result.status === 'error') log.warn(`snapshot not copied: ${result.message}`);
        setNotice({ ...current, copied: result.status === 'copied' ? 'copied' : 'failed' });
      },
      (error: unknown) => {
        log.error(`copy to clipboard failed: ${errorMessage(error)}`);
        setNotice({ ...current, copied: 'failed' });
      },
    );
  };

  return {
    notice,
    take,
    copy,
    dismiss: () => {
      setNotice(undefined);
    },
  };
}
