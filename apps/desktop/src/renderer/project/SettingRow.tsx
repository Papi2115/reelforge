/** One row of the Project settings dialog: a title, its control and when the change applies. */
import { useId, type JSX, type ReactNode } from 'react';
import type {
  LookSummary,
  ProjectSettings,
  ProjectSettingsPatch,
} from '../../shared/project-settings-contract.js';

interface SettingRowProps {
  readonly title: string;
  /** When the change takes effect. */
  readonly note: string;
  /** The control; `labelId` names it (e.g. `aria-labelledby` of a radio group). */
  readonly children: (labelId: string) => ReactNode;
}

export function SettingRow({ title, note, children }: SettingRowProps): JSX.Element {
  const labelId = useId();
  return (
    <div className="project-setting-row">
      <span className="project-setting-title" id={labelId}>
        {title}
      </span>
      {children(labelId)}
      <p className="project-setting-note muted">{note}</p>
    </div>
  );
}

/** What every row gets: the effective settings, the kit's looks and the change callback. */
export interface RowProps {
  readonly settings: ProjectSettings;
  readonly looks: readonly LookSummary[];
  readonly update: (patch: ProjectSettingsPatch) => void;
}
