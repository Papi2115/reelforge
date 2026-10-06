/**
 * A header menu button (Help, the project menu): a button that opens a list of menu items, with
 * arrow-key navigation; Escape and clicks outside close it and focus returns to the button.
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';

export interface MenuItem {
  readonly label: string;
  readonly run: () => void;
  /** Why the item is unavailable (shown as its tooltip); undefined = available. */
  readonly disabled?: string;
  /** Keyboard shortcut shown next to the label. */
  readonly keys?: string;
}

export interface MenuButtonProps {
  /** The button's content (its accessible name). */
  readonly label: ReactNode;
  /** Accessible name of the opened menu. */
  readonly menuLabel: string;
  readonly items: readonly MenuItem[];
  readonly className?: string;
  readonly buttonClassName?: string;
  readonly title?: string;
}

const ITEMS = '[role="menuitem"]:not(:disabled)';

export function MenuButton(props: MenuButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLButtonElement>(ITEMS)?.focus();
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
    const buttons = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>(ITEMS) ?? [])];
    const current = buttons.findIndex((button) => button === document.activeElement);
    buttons[(current + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div
      className={`menu-root ${props.className ?? ''}`.trim()}
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
        className={props.buttonClassName ?? 'link-button'}
        aria-haspopup="menu"
        aria-expanded={open}
        title={props.title}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {props.label}
      </button>
      {open && (
        <div className="menu-list" role="menu" aria-label={props.menuLabel}>
          {props.items.map((item) => (
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
