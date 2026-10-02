/**
 * Draggable, keyboard-operable divider between two panes (WAI-ARIA window splitter): pointer drag
 * with capture, arrow keys move by PANE_KEY_STEP, Home/End jump to the limits.
 */
import { useRef, type JSX, type KeyboardEvent, type PointerEvent } from 'react';
import { PANE_KEY_STEP } from './pane-sizes.js';

export interface SplitterProps {
  readonly label: string;
  /** `vertical` divides columns (drag left/right), `horizontal` divides rows. */
  readonly orientation: 'vertical' | 'horizontal';
  /** Size of the pane this splitter resizes. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  /** True when dragging towards the start (left/up) makes the pane larger. */
  readonly growsTowardsStart: boolean;
  readonly onChange: (value: number) => void;
  readonly className?: string;
}

export function Splitter(props: SplitterProps): JSX.Element {
  const { orientation, value, min, max, growsTowardsStart, onChange } = props;
  const drag = useRef<{ readonly start: number; readonly value: number } | undefined>(undefined);
  const sign = growsTowardsStart ? -1 : 1;
  const position = (event: PointerEvent): number =>
    orientation === 'vertical' ? event.clientX : event.clientY;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { start: position(event), value };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const current = drag.current;
    if (!current) return;
    onChange(current.value + sign * (position(event) - current.start));
  };
  const endDrag = (): void => {
    drag.current = undefined;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const [towardsStart, towardsEnd] =
      orientation === 'vertical' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    let next: number | undefined;
    if (event.key === towardsStart) next = value - sign * PANE_KEY_STEP;
    else if (event.key === towardsEnd) next = value + sign * PANE_KEY_STEP;
    else if (event.key === 'Home') next = min;
    else if (event.key === 'End') next = max;
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={props.label}
      aria-orientation={orientation}
      aria-valuenow={Math.round(value)}
      aria-valuemin={Math.round(min)}
      aria-valuemax={Math.round(Math.max(min, max))}
      className={`splitter splitter-${orientation} ${props.className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    />
  );
}
