/**
 * Right-click menu of a shot in the Shots panel: Variants… (V, PLAN.md#11.3), Rebuild this shot
 * and Lock / Unlock (Shift+L). Closes on Escape, a click elsewhere or after a choice.
 */
import { useEffect, useRef, type JSX } from 'react';

export interface ShotMenuAnchor {
  readonly shotId: string;
  /** Viewport position of the click (px). */
  readonly x: number;
  readonly y: number;
}

export interface ShotContextMenuProps {
  readonly anchor: ShotMenuAnchor;
  readonly locked: boolean;
  /** Why rebuilding / variants are unavailable now (null = available). */
  readonly blocked: string | null;
  readonly onVariants: (shotId: string) => void;
  readonly onRebuild: (shotId: string) => void;
  readonly onLock: (shotIds: readonly string[], locked: boolean) => void;
  readonly onClose: () => void;
}

export function ShotContextMenu(props: ShotContextMenuProps): JSX.Element {
  const { anchor, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onPointer = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || !ref.current?.contains(event.target)) onClose();
    };
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);
  const lockedNote = 'Shot is locked — unlock first';
  const busy = props.locked ? lockedNote : props.blocked;
  const choose = (action: () => void) => (): void => {
    action();
    onClose();
  };
  return (
    <div
      ref={ref}
      className="shot-menu"
      role="menu"
      aria-label={`Shot ${anchor.shotId}`}
      style={{ left: anchor.x, top: anchor.y }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        role="menuitem"
        aria-disabled={props.locked}
        title={props.locked ? lockedNote : 'Build 2–3 alternative versions and pick one (V)'}
        onClick={choose(() => {
          if (!props.locked) props.onVariants(anchor.shotId);
        })}
      >
        Variants…
        <kbd>V</kbd>
      </button>
      <button
        type="button"
        role="menuitem"
        aria-disabled={busy !== null}
        title={busy ?? 'Build this shot again (scene-build + QA)'}
        onClick={choose(() => {
          if (busy === null) props.onRebuild(anchor.shotId);
        })}
      >
        Rebuild this shot
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={choose(() => {
          props.onLock([anchor.shotId], !props.locked);
        })}
      >
        {props.locked ? 'Unlock' : 'Lock'}
        <kbd>Shift+L</kbd>
      </button>
    </div>
  );
}
