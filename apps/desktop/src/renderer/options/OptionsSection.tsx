/**
 * "All options" of a pipeline step (step-options-view.ts): a section that starts open at the end
 * of the step's panel and hosts the project.json option rows that steer the step. The rows are the
 * Project settings components (option-registry.ts) on their own controller, so a switch here
 * writes project.json once and commits it exactly as from Project settings.
 */
import { useState, type JSX } from 'react';
import { Disclosure } from '../layout/Disclosure.js';
import { useProjectSettings } from '../project/use-project-settings.js';
import { OptionRow } from '../project/WorldRows.js';
import {
  OPTIONS_SUMMARY,
  OPTIONS_TITLE,
  optionsStatus,
  stepOptionRows,
} from './step-options-view.js';

/** Renders nothing for a step without option rows. */
export function OptionsSection({ step }: { readonly step: string }): JSX.Element | null {
  const rows = stepOptionRows(step);
  return rows.length === 0 ? null : <OptionsBody rows={rows} />;
}

function OptionsBody({ rows }: { readonly rows: ReturnType<typeof stepOptionRows> }): JSX.Element {
  const controller = useProjectSettings();
  const { settings } = controller;
  const [open, setOpen] = useState(true);
  return (
    <Disclosure
      title={OPTIONS_TITLE}
      summary={OPTIONS_SUMMARY}
      open={open}
      onToggle={setOpen}
      className="options-section"
    >
      {settings === undefined && controller.error === undefined && (
        <p className="muted">Loading…</p>
      )}
      {settings !== undefined &&
        rows.map((id) => (
          <OptionRow
            key={id}
            id={id}
            settings={settings}
            looks={controller.looks}
            style={controller.style}
            update={controller.update}
          />
        ))}
      {controller.error !== undefined && (
        <p className="connect-error" role="alert">
          {controller.error}
        </p>
      )}
      <p className="options-status muted" aria-live="polite">
        {optionsStatus(controller.pending)}
      </p>
    </Disclosure>
  );
}
