/**
 * The Variants dock of the workspace (PLAN.md#11.3): which shot's variants are open, the V
 * shortcut on the selected shot, reopening the view after an app restart when a project still has
 * variants waiting for a decision, and "Play in preview": the main player shows the card's scene
 * (a substituted manifest, hot reloaded) from the shot's start and loops the shot's time range.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StagesState } from '../../shared/stages-contract.js';
import type { VariantKey } from '../../shared/variants-contract.js';
import type { Player } from '../preview/player.js';
import type { PreviewSource } from '../preview/preview-source.js';
import { keyTargetOf } from '../preview/transport-keys.js';
import { useVariants, type VariantsControls } from './use-variants.js';
import { isVariantsShortcut, shotsWithVariants } from './variants-view.js';

export interface VariantsDockOptions {
  readonly dir: string;
  readonly stages: StagesState | undefined;
  readonly player: Player;
  readonly time: number;
  readonly playing: boolean;
  readonly shots: readonly StoryboardShot[];
  readonly selectedShotId: string | undefined;
  /** Called when the dock opens (other center documents close). */
  readonly onOpen: () => void;
}

export interface VariantsDock {
  readonly controls: VariantsControls;
  /** The shot whose variants are open (null = dock closed). */
  readonly shotId: string | null;
  readonly open: (shotId: string) => void;
  readonly close: () => void;
  readonly previewKey: VariantKey | null;
  readonly setPreview: (key: VariantKey | null) => void;
  /** Shots with variants waiting for a decision. */
  readonly withVariants: ReadonlySet<string>;
  /** The preview's source: the project, or the project with the previewed variant. */
  readonly source: (revision: number) => PreviewSource;
}

export function useVariantsDock(options: VariantsDockOptions): VariantsDock {
  const { dir, player, shots, selectedShotId, onOpen } = options;
  const controls = useVariants(dir, options.stages);
  const [shotId, setShotId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState<VariantKey | null>(null);
  const resumed = useRef(false);
  const shot = shots.find((entry) => entry.id === shotId);

  const open = useCallback(
    (id: string) => {
      setPreviewKey(null);
      setShotId(id);
      onOpen();
    },
    [onOpen],
  );
  const close = useCallback(() => {
    setPreviewKey(null);
    setShotId(null);
  }, []);
  const setPreview = useCallback(
    (key: VariantKey | null) => {
      setPreviewKey(key);
      if (shot === undefined) return;
      player.seek(shot.t0);
      if (key === null) player.pause();
      else player.play();
    },
    [player, shot],
  );

  // After a restart: variants still waiting for a decision bring their view back once.
  useEffect(() => {
    if (resumed.current || controls.state === undefined) return;
    resumed.current = true;
    const first = controls.state.sets[0];
    if (first !== undefined && shotId === null) open(first.shotId);
  }, [controls.state, open, shotId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (selectedShotId === undefined) return;
      const shortcut = isVariantsShortcut({
        key: event.key,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        repeat: event.repeat,
        target: keyTargetOf(event.target),
      });
      if (!shortcut) return;
      event.preventDefault();
      open(selectedShotId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, selectedShotId]);

  // "Play in preview" loops the shot's own time range.
  const { time, playing } = options;
  useEffect(() => {
    if (previewKey === null || shot === undefined || !playing) return;
    if (time >= shot.t1 || time < shot.t0 - 0.5) player.seek(shot.t0);
  }, [previewKey, shot, playing, time, player]);

  const source = useCallback(
    (revision: number): PreviewSource =>
      previewKey === null || previewKey === 'current' || shotId === null
        ? { kind: 'project', revision }
        : { kind: 'variant', revision, shotId, key: previewKey },
    [previewKey, shotId],
  );

  return {
    controls,
    shotId,
    open,
    close,
    previewKey,
    setPreview,
    withVariants: shotsWithVariants(controls.state),
    source,
  };
}
