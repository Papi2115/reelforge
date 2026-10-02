/** Minimal modal confirmation (in-page, no native dialog). */
import { useEffect, useRef, type JSX, type ReactNode } from 'react';

export interface ConfirmDialogProps {
  readonly title: string;
  readonly children: ReactNode;
  readonly confirmLabel: string;
  readonly busy: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={props.title}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !props.busy) props.onCancel();
        }}
      >
        <h2 className="modal-title">{props.title}</h2>
        <div className="modal-body">{props.children}</div>
        <div className="modal-actions">
          <button ref={cancelRef} type="button" disabled={props.busy} onClick={props.onCancel}>
            Cancel
          </button>
          <button type="button" className="danger" disabled={props.busy} onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
