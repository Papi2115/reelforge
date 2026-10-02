/**
 * Dialogs of the Help menu (PLAN.md#10.3): keyboard shortcuts, About ReelForge (version, licences,
 * the personal-use / subscription note) and Report a problem (opens the logs folder; nothing is
 * sent anywhere).
 */
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react';
import type { AppInfo } from '../../shared/ipc-contract.js';
import type { HelpTarget } from '../../shared/onboarding-contract.js';
import { errorMessage } from '../log.js';

export type HelpDialogKind = 'shortcuts' | 'about' | 'report';

/** Shortcut sheet: the player (transport-keys.ts), the timeline and the chat composer. */
export const SHORTCUT_GROUPS: readonly {
  readonly title: string;
  readonly keys: readonly (readonly [string, string])[];
}[] = [
  {
    title: 'Player',
    keys: [
      ['Space', 'Play / pause'],
      ['← / →', 'One frame back / forward'],
      ['Shift + ← / →', 'One second back / forward'],
      ['Home / End', 'Start / end of the video'],
      ['J / K / L', 'Slower / pause / play faster'],
      ['M', 'Mute'],
    ],
  },
  {
    title: 'Timeline',
    keys: [
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y, Ctrl + Shift + Z', 'Redo'],
      ['Delete', 'Delete the selected cue'],
      ['← / → (cue selected)', 'Nudge the cue (Shift: more)'],
      ['+ / −', 'Zoom in / out'],
      ['Esc', 'Clear the selection'],
    ],
  },
  {
    title: 'Chat',
    keys: [
      ['Enter', 'Send the message'],
      ['Shift + Enter', 'New line'],
      ['Esc', 'Stop Claude while it works'],
    ],
  },
];

function HelpDialog(props: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}): JSX.Element {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <div className="modal-backdrop">
      <div
        className="modal help-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onKeyDown={(event) => {
          if (event.key === 'Escape') props.onClose();
        }}
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
        <HelpDialog title="Keyboard shortcuts" onClose={props.onClose}>
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="shortcut-group">
              <h3>{group.title}</h3>
              <dl>
                {group.keys.map(([keys, action]) => (
                  <div key={keys} className="shortcut-row">
                    <dt>
                      <kbd>{keys}</kbd>
                    </dt>
                    <dd>{action}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
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
                : ` · Electron ${props.info.electron} · Chrome ${props.info.chrome}`}
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
            The log has file paths and stage messages, never your Claude credentials. Have a look
            before you share it.
          </p>
        </HelpDialog>
      );
  }
}
