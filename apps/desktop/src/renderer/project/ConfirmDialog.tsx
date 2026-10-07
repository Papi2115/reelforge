/** Minimal modal confirmation (in-page, no native dialog). */
import { useEffect, useRef, type JSX, type ReactNode } from 'react';
import { useEscapeToClose } from '../layout/use-escape-to-close.js';

export interface ConfirmDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  /** Class of the confirm button (default `danger`; e.g. `primary` for a download). */
  readonly confirmClass?: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  // Esc cancels this box only, never the dialog under it (escape-layers.ts).
  useEscapeToClose(() => {
    if (!props.busy) props.onCancel();
  });
  return (
    <div className="modal-backdrop">
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={props.title}>
        <h2 className="modal-title">{props.title}</h2>
        <div className="modal-body">{props.children}</div>
        <div className="modal-actions">
          <button ref={cancelRef} type="button" disabled={props.busy} onClick={props.onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={props.confirmClass ?? 'danger'}
            disabled={props.busy}
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
