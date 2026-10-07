/**
 * The header's "Needs you" inbox (docs/ux/redesign-2.4.md §2.3, U7): a button with the count
 * (orange only when something waits) and a popover listing every item of
 * stages/attention-view.ts as one sentence + one button that goes there (open-stage.ts). Ctrl+Shift+N
 * opens / closes it; Escape closes it and focus returns to the button; a click outside closes it.
 * A count change is announced politely (no sound). Rendered by the workspace into a slot of the
 * header (`slot`), from the data the workspace already holds (stage state, reports, shot plan,
 * assets) plus the dramaturgy / editing / claims reads of use-needs-you.ts.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import type { AssetsState } from '../../shared/assets-contract.js';
import type { ProjectSnapshot } from '../../shared/snapshot-contract.js';
import type { StagesState } from '../../shared/stages-contract.js';
import {
  ATTENTION_EMPTY,
  attentionAnnouncement,
  attentionItems,
  attentionLabel,
  type AttentionItem,
} from '../stages/attention-view.js';
import { stationFacts } from '../stages/stations-view.js';
import { NEEDS_YOU_KEYS } from './app-keys.js';
import { openAttentionTarget, type AttentionOpeners } from './open-stage.js';
import { useAppShortcut } from './use-app-shortcut.js';
import { useAttentionSources } from './use-needs-you.js';
import { shotsPreflight, type PreflightSources } from './WorkspaceDialogs.js';

export interface NeedsYouProject extends PreflightSources {
  /** Reloaded on every project change: the other reports are read again after it. */
  readonly snapshot: ProjectSnapshot | undefined;
  readonly state: StagesState | undefined;
  readonly assets: AssetsState | undefined;
}

export interface NeedsYouProps {
  /** The header element the button renders into (null while the header mounts). */
  readonly slot: HTMLElement | null;
  readonly dir: string;
  readonly project: NeedsYouProject;
  readonly open: AttentionOpeners;
}

export function NeedsYou({ slot, dir, project, open }: NeedsYouProps): JSX.Element | null {
  const sources = useAttentionSources(dir, project.snapshot);
  if (slot === null) return null;
  const items = attentionItems({
    ...sources,
    state: project.state,
    facts: stationFacts(project.reports?.scenes ?? null, project.shots, project.built),
    shots: shotsPreflight(project).items,
    words: project.reports?.words,
    assets: project.assets,
  });
  return createPortal(<NeedsYouInbox items={items} openers={open} />, slot);
}

/** The polite announcement: empty at first, then the new count after every change. */
function useCountAnnouncement(count: number): string {
  const previous = useRef(count);
  const [text, setText] = useState('');
  useEffect(() => {
    if (previous.current === count) return;
    previous.current = count;
    setText(attentionAnnouncement(count));
  }, [count]);
  return text;
}

function NeedsYouInbox(props: {
  readonly items: readonly AttentionItem[];
  readonly openers: AttentionOpeners;
}): JSX.Element {
  const { items, openers } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const announcement = useCountAnnouncement(items.length);

  const close = (): void => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  useAppShortcut('needs-you', () => {
    if (open) close();
    else setOpen(true);
  });

  useEffect(() => {
    if (!open) return;
    const first = dialogRef.current?.querySelector<HTMLButtonElement>('li button');
    (first ?? dialogRef.current)?.focus();
    const onPointer = (event: PointerEvent): void => {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target) !== true) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const count = items.length;
  return (
    <div
      className="needs-you"
      ref={rootRef}
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return;
        // The innermost popover closes first (nothing else reacts to this Escape).
        event.stopPropagation();
        close();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="link-button needs-you-button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={attentionLabel(count)}
        title={`What waits for your decision (${NEEDS_YOU_KEYS})`}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        Needs you
        <span className={`needs-you-count${count > 0 ? ' has-items' : ''}`} aria-hidden="true">
          {count}
        </span>
      </button>
      <span className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
      {open && (
        <div
          className="needs-you-popover"
          role="dialog"
          aria-label="Needs you"
          tabIndex={-1}
          ref={dialogRef}
        >
          {count === 0 ? (
            <p className="needs-you-empty">{ATTENTION_EMPTY}</p>
          ) : (
            <ul className="needs-you-list" aria-label="What waits for you">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`needs-you-item group-${item.group}`}
                  title={item.detail}
                >
                  <span className="needs-you-subject">{item.subject}</span>
                  <span className="needs-you-text">{item.text}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      openAttentionTarget(item.target, openers);
                    }}
                  >
                    {item.button}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
