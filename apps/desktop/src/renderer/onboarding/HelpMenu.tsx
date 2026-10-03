/**
 * Help menu of the header (PLAN.md#10.3): the tour (when a project is open), keyboard shortcuts,
 * the logs folder, Report a problem and About. A menu button with arrow-key navigation; Escape
 * and clicks outside close it.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { errorMessage, rendererLog } from '../log.js';
import type { HelpDialogKind } from './HelpDialogs.js';

const log = rendererLog('help');

export interface HelpMenuProps {
  /** Starts the tour; null while no project is open (the tour shows the workspace). */
  readonly onTour: (() => void) | null;
  readonly onDialog: (kind: HelpDialogKind) => void;
}

interface Item {
  readonly label: string;
  readonly run: () => void;
  readonly disabled?: string;
  /** Keyboard shortcut shown next to the label. */
  readonly keys?: string;
}

export function HelpMenu({ onTour, onDialog }: HelpMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const items: Item[] = [
    {
      label: 'Take the tour',
      run: () => onTour?.(),
      ...(onTour === null ? { disabled: 'Open a project first' } : {}),
    },
    {
      label: 'Keyboard shortcuts',
      keys: '?',
      run: () => {
        onDialog('shortcuts');
      },
    },
    {
      label: 'Open logs folder',
      run: () => {
        window.reelforge.openHelpTarget('logs').catch((error: unknown) => {
          log.error(`open logs failed: ${errorMessage(error)}`);
        });
      },
    },
    {
      label: 'Report a problem…',
      run: () => {
        onDialog('report');
      },
    },
    {
      label: 'About ReelForge',
      run: () => {
        onDialog('about');
      },
    },
  ];

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
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

  const moveFocus = (step: number): void => {
    const buttons = [
      ...(rootRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? []),
    ];
    const current = buttons.findIndex((button) => button === document.activeElement);
    buttons[(current + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div
      className="help-menu"
      ref={rootRef}
      onKeyDown={(event) => {
        if (!open) return;
        if (event.key === 'Escape') {
          setOpen(false);
          buttonRef.current?.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          moveFocus(event.key === 'ArrowDown' ? 1 : -1);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="link-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        Help
      </button>
      {open && (
        <div className="help-menu-list" role="menu" aria-label="Help">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled !== undefined}
              title={item.disabled}
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              {item.label}
              {item.keys !== undefined && <kbd className="menu-keys">{item.keys}</kbd>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
