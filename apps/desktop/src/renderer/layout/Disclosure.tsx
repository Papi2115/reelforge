/**
 * A titled section that opens and closes (PLAN.md#11.2); the caller keeps (and remembers) whether
 * it is open. The toggle is a button with aria-expanded; the body is not rendered while closed.
 */
import { useId, type JSX, type ReactNode } from 'react';
import { ChevronIcon } from './icons.js';

export interface DisclosureProps {
  readonly title: string;
  /** One short line after the title (e.g. a count). */
  readonly summary?: string | undefined;
  readonly open: boolean;
  readonly onToggle: (open: boolean) => void;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Disclosure(props: DisclosureProps): JSX.Element {
  const bodyId = useId();
  return (
    <section className={`disclosure ${props.className ?? ''}`} aria-label={props.title}>
      <button
        type="button"
        className="disclosure-toggle"
        aria-expanded={props.open}
        aria-controls={bodyId}
        onClick={() => {
          props.onToggle(!props.open);
        }}
      >
        <ChevronIcon direction={props.open ? 'down' : 'right'} />
        {props.title}
        {props.summary !== undefined && <span className="muted">{props.summary}</span>}
      </button>
      {props.open && (
        <div className="disclosure-body" id={bodyId}>
          {props.children}
        </div>
      )}
    </section>
  );
}
