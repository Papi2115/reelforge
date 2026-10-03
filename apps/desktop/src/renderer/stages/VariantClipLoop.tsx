/**
 * A card's looping low-res clip (PLAN.md#11.3): main renders 8–24 frames of the shot through the
 * engine (cached PNGs under `.reelforge/frames/variants/`), shown here in a loop at the clip's
 * rate. App code: timers are fine here (never in scenes).
 */
import { useEffect, useState, type JSX } from 'react';
import { projectMediaUrl } from '../../shared/player-contract.js';
import type { VariantClip, VariantKey } from '../../shared/variants-contract.js';
import { errorMessage } from '../log.js';

export interface VariantClipLoopProps {
  readonly shotId: string;
  readonly cardKey: VariantKey;
  readonly label: string;
}

export function VariantClipLoop({ shotId, cardKey, label }: VariantClipLoopProps): JSX.Element {
  const [clip, setClip] = useState<VariantClip | undefined>(undefined);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let active = true;
    setClip(undefined);
    window.reelforge.getVariantClip(shotId, cardKey).then(
      (next) => {
        if (active) setClip(next);
      },
      (error: unknown) => {
        if (active) setClip({ status: 'error', message: errorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [shotId, cardKey]);

  const count = clip?.status === 'ok' ? clip.frames.length : 0;
  const fps = clip?.status === 'ok' ? clip.fps : 1;
  useEffect(() => {
    if (count < 2) return;
    setFrame(0);
    const timer = window.setInterval(
      () => {
        setFrame((current) => (current + 1) % count);
      },
      Math.round(1000 / fps),
    );
    return () => {
      window.clearInterval(timer);
    };
  }, [count, fps]);

  if (clip === undefined) {
    return <div className="variant-clip pending">Rendering preview…</div>;
  }
  if (clip.status === 'error') {
    return (
      <div className="variant-clip failed" title={clip.message}>
        No preview
      </div>
    );
  }
  return (
    <div className="variant-clip" data-frames={count} data-testid={`variant-clip-${cardKey}`}>
      {clip.frames.map((file, index) => (
        <img
          key={file}
          src={projectMediaUrl(file, clip.revision)}
          alt={index === frame ? label : ''}
          className={index === frame ? 'shown' : undefined}
          draggable={false}
        />
      ))}
    </div>
  );
}
