/**
 * Dialogs of the Help menu (PLAN.md#10.3): Keyboard shortcuts (every shortcut by group, generated
 * from layout/shortcut-table.ts, the table the window-wide keys are matched from), About ReelForge
 * (version and the Electron / Chrome versions — the header no longer shows them, licences, the
 * personal-use / subscription note) and Report a problem (opens the logs folder; nothing is sent
 * anywhere).
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import type { AppInfo } from '../../shared/ipc-contract.js';
import type { HelpTarget } from '../../shared/onboarding-contract.js';
import { shortcutSections } from '../layout/shortcut-table.js';
import { useEscapeToClose } from '../layout/use-escape-to-close.js';
import { errorMessage } from '../log.js';

export type HelpDialogKind = 'shortcuts' | 'about' | 'report';

function HelpDialog(props: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  /** Extra class of the dialog box (the shortcuts dialog is wider). */
  readonly className?: string;
}): JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  // Opened over another dialog (? in Project settings), Esc closes only this one.
  useEscapeToClose(props.onClose);
  return (
    <div className="modal-backdrop">
      <div
        className={`modal help-dialog ${props.className ?? ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
      >
        <h2 className="modal-title">{props.title}</h2>
        <div className="modal-body help-body">{props.children}</div>
        <div className="modal-actions">
          {props.actions}
          <button ref={closeRef} type="button" onClick={props.onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function OpenTargetButton(props: {
  readonly target: HelpTarget;
  readonly label: string;
}): JSX.Element {
  const [problem, setProblem] = useState<string | undefined>(undefined);
  return (
    <>
      {problem !== undefined && (
        <span className="help-problem" role="alert">
          {problem}
        </span>
      )}
      <button
        type="button"
        className="primary"
        onClick={() => {
          setProblem(undefined);
          window.reelforge.openHelpTarget(props.target).then(
            (result) => {
              if (result.status === 'error') setProblem(result.message);
            },
            (error: unknown) => {
              setProblem(errorMessage(error));
            },
          );
        }}
      >
        {props.label}
      </button>
    </>
  );
}

export function HelpDialogs(props: {
  readonly kind: HelpDialogKind;
  readonly info: AppInfo | undefined;
  readonly onClose: () => void;
}): JSX.Element {
  switch (props.kind) {
    case 'shortcuts':
      return (
        <HelpDialog title="Keyboard shortcuts" className="shortcuts-dialog" onClose={props.onClose}>
          <div className="shortcut-groups">
            {shortcutSections().map((section) => (
              <section
                key={section.group}
                className="shortcut-group"
                aria-label={`${section.title} shortcuts`}
              >
                <h3>{section.title}</h3>
                <dl>
                  {section.rows.map(({ id, keys, action }) => (
                    <div key={id} className="shortcut-row">
                      <dt>
                        <kbd>{keys}</kbd>
                      </dt>
                      <dd>{action}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </HelpDialog>
      );
    case 'about':
      return (
        <HelpDialog
          title="About ReelForge"
          onClose={props.onClose}
          actions={<OpenTargetButton target="licenses" label="Open licences" />}
        >
          <p>
            <strong>ReelForge</strong> {props.info?.version ?? ''}
            <span className="muted">
              {props.info === undefined
                ? ''
                : ` · Electron ${props.info.electron} · Chrome ${props.info.chrome}${props.info.dev ? ' · dev' : ''}`}
            </span>
          </p>
          <p>
            Short brief → script → your voiceover → deterministic voxel animation → MP4, made on
            your computer. Projects are folders with their own git history; nothing goes to a cloud
            and there is no telemetry.
          </p>
          <p>
            Claude runs through the Claude Code CLI you installed and logged in to yourself, on your
            own Claude subscription. ReelForge never reads, stores or sends your credentials. This
            version is for personal use under the terms of your Claude plan.
          </p>
          <p className="muted">
            Fonts, the example project and the art are CC0; open-source parts keep their own
            licences (MIT, Apache-2.0, …), listed in the licences file.
          </p>
        </HelpDialog>
      );
    case 'report':
      return (
        <HelpDialog
          title="Report a problem"
          onClose={props.onClose}
          actions={<OpenTargetButton target="logs" label="Open logs folder" />}
        >
          <p>
            ReelForge sends nothing over the network, so reports are by hand: open the logs folder,
            take <code>main.log</code> and describe what you did and what you expected.
          </p>
          <p className="muted">
            The log has file paths and step messages, never your Claude credentials. Have a look
            before you share it.
          </p>
        </HelpDialog>
      );
  }
}
