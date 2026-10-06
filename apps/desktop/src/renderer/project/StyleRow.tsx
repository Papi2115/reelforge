/**
 * Project settings → Visuals → "Style" (PLAN.md#13.6): the project's style, read-only (a project
 * keeps the style it was created with), its one-line description, the "preview" tag of an
 * experimental world and, while the experimental switch is off, why it cannot build in it.
 */
import type { JSX } from 'react';
import { SettingRow, type RowProps } from './SettingRow.js';
import { PREVIEW_TAG, STYLE_ROW_NOTE, styleBlockedText } from './world-settings-view.js';

export function StyleRow({ style }: RowProps): JSX.Element {
  const blocked = style === undefined ? undefined : styleBlockedText(style);
  return (
    <SettingRow title="Style" note={STYLE_ROW_NOTE}>
      {() =>
        style === undefined ? (
          <p className="option-readonly muted">Loading…</p>
        ) : (
          <>
            <p className="option-readonly project-style">
              <strong>{style.label}</strong>
              {style.preview && (
                <>
                  {' '}
                  <span className="style-preview-tag">{PREVIEW_TAG}</span>
                </>
              )}
              {style.description !== '' && <span className="muted"> — {style.description}</span>}
            </p>
            {blocked !== undefined && <p className="project-style-blocked">{blocked}</p>}
          </>
        )
      }
    </SettingRow>
  );
}
