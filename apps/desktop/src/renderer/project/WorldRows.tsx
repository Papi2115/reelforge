/**
 * `OptionRow` (PLAN.md#13.6): renders an option row or, in a world's project, what applies
 * instead (the world's own A/B/C looks; no character pack or mascot) with a one-line reason. The
 * Project settings dialog and the steps' "All options" sections render rows through it, so both
 * follow the same rule. A world whose looks are optional (Grim Ink, PLAN.md#14.12) lists them with
 * an on/off box each (project.json `worldLooks`; at least one stays on).
 */
import type { JSX } from 'react';
import { OPTION_ROWS } from './option-registry.js';
import type { OptionRowId } from './project-settings-view.js';
import { SettingRow, type RowProps } from './SettingRow.js';
import {
  toggledWorldLooks,
  WORLD_LOOKS_NOTE,
  worldLookLines,
  worldLookToggles,
  worldRowNotice,
  type WorldRowNotice,
} from './world-settings-view.js';

export const WORLD_ROW_NOTE = "Nothing to switch here in a world's project.";

function WorldNoticeRow({
  id,
  notice,
  looks,
}: {
  readonly id: OptionRowId;
  readonly notice: WorldRowNotice;
  readonly looks: RowProps['looks'];
}): JSX.Element {
  const lines = id === 'look-mode' ? worldLookLines(looks) : [];
  return (
    <SettingRow title={notice.title} note={WORLD_ROW_NOTE}>
      {() => (
        <>
          <p className="option-readonly world-row-reason">{notice.reason}</p>
          {lines.length > 0 && (
            <ul className="project-setting-looks" aria-label="Looks of this world">
              {lines.map((line) => (
                <li key={line.id}>
                  <strong>{line.title}</strong>
                  <span className="muted"> — {line.description}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SettingRow>
  );
}

/** "Looks of this world" with an on/off box per look (a world whose looks are optional). */
function WorldLooksRow({
  notice,
  looks,
  settings,
  update,
}: RowProps & { readonly notice: WorldRowNotice }): JSX.Element {
  const toggles = worldLookToggles(looks, settings.worldLooks);
  return (
    <SettingRow title={notice.title} note={WORLD_LOOKS_NOTE}>
      {(labelId) => (
        <>
          <p className="option-readonly world-row-reason">{notice.reason}</p>
          <div role="group" aria-labelledby={labelId}>
            {toggles.map((look) => (
              <label key={look.id} className="settings-toggle">
                <input
                  type="checkbox"
                  checked={look.checked}
                  disabled={look.locked}
                  onChange={(event) => {
                    const next = toggledWorldLooks(
                      looks,
                      settings.worldLooks,
                      look.id,
                      event.target.checked,
                    );
                    update({ worldLooks: next === null ? null : [...next] });
                  }}
                />
                <span>
                  <strong>{look.title}</strong>
                  <span className="muted">{look.description}</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </SettingRow>
  );
}

/** An option row; in a world's project, the rows that do not apply show why instead. */
export function OptionRow({ id, ...props }: RowProps & { readonly id: OptionRowId }): JSX.Element {
  const notice = worldRowNotice(id, props.style);
  if (notice !== undefined && id === 'look-mode' && props.style?.optionalLooks === true) {
    return <WorldLooksRow {...props} notice={notice} />;
  }
  if (notice !== undefined) return <WorldNoticeRow id={id} notice={notice} looks={props.looks} />;
  const Row = OPTION_ROWS[id];
  return <Row {...props} />;
}
