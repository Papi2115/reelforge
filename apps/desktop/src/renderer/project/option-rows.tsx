/**
 * The option rows of a project (project.json): look mode, ambient variation, continuity links,
 * tension map, dramaturgy, editing, scenes per minute and the read-only sound palette line. The
 * Project settings dialog and the steps' "All options" sections render these same components
 * (option-registry.ts), so a switch behaves and commits the same wherever it is clicked.
 */
import { useId, type JSX } from 'react';
import {
  AMBIENT_NOTE,
  CAPTIONS_HINT,
  CAPTIONS_NOTE,
  CONTINUITY_HINT,
  CONTINUITY_NOTE,
  DRAMATURGY_CHOICES,
  DRAMATURGY_NOTE,
  EDITING_CHOICES,
  EDITING_NOTE,
  LOOK_MODE_NOTE,
  lookModeChoices,
  SOUND_PALETTE_NOTE,
  soundPaletteText,
  TENSION_MAP_NOTE,
} from './project-settings-view.js';
import { SceneCountFields } from './SceneCountFields.js';
import { SCENE_COUNT_HINT, SCENE_COUNT_NOTE } from './scene-count-view.js';
import { SettingRow, type RowProps } from './SettingRow.js';

export function LookModeRow({ settings, looks, update }: RowProps): JSX.Element {
  const name = useId();
  return (
    <SettingRow title="Look mode" note={LOOK_MODE_NOTE}>
      {(labelId) => (
        <>
          <div className="project-setting-choices" role="radiogroup" aria-labelledby={labelId}>
            {lookModeChoices(looks).map((choice) => (
              <label key={choice.value} className="settings-toggle">
                <input
                  type="radio"
                  name={name}
                  value={choice.value}
                  checked={settings.lookMode === choice.value}
                  onChange={() => {
                    update({ lookMode: choice.value });
                  }}
                />
                <span>
                  <strong>{choice.title}</strong>
                  <span className="muted">{choice.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {looks.length > 0 && (
            <ul className="project-setting-looks" aria-label="Available looks">
              {looks.map((look) => (
                <li key={look.id}>
                  <strong>{look.label}</strong>
                  <span className="muted"> — {look.description}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </SettingRow>
  );
}

export function AmbientRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Ambient variation" note={AMBIENT_NOTE}>
      {() => (
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.ambientVariation}
            onChange={(event) => {
              update({ ambientVariation: event.target.checked });
            }}
          />
          <span>
            <strong>Vary backgrounds subtly between shots</strong>
            <span className="muted">
              Sky, grid, light and background details drift from shot to shot within the palette of
              the style, so neighbouring shots never look identical.
            </span>
          </span>
        </label>
      )}
    </SettingRow>
  );
}

/** Continuity links between shots (PLAN.md#13.2): `project.continuityLinks`, off by default. */
export function ContinuityLinksRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Continuity links" note={CONTINUITY_NOTE}>
      {() => (
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.continuityLinks}
            onChange={(event) => {
              update({ continuityLinks: event.target.checked });
            }}
          />
          <span>
            <strong>Continuity links between shots</strong>
            <span className="muted">{CONTINUITY_HINT}</span>
          </span>
        </label>
      )}
    </SettingRow>
  );
}

/** A film's captions (PLAN.md#14.18): `project.captions`, off by default. */
export function CaptionsRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Captions" note={CAPTIONS_NOTE}>
      {() => (
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.captions === 'words'}
            onChange={(event) => {
              update({ captions: event.target.checked ? 'words' : 'off' });
            }}
          />
          <span>
            <strong>Captions in the film</strong>
            <span className="muted">{CAPTIONS_HINT}</span>
          </span>
        </label>
      )}
    </SettingRow>
  );
}

/** Tension map (PLAN.md#12.22): the dramatic curve steers tempo, looks, music and backgrounds. */
export function TensionMapRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Tension map" note={TENSION_MAP_NOTE}>
      {() => (
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={settings.tensionMap === 'auto'}
            onChange={(event) => {
              update({ tensionMap: event.target.checked ? 'auto' : 'off' });
            }}
          />
          <span>
            <strong>Steer the film by a tension curve</strong>
            <span className="muted">
              Calm, rising, peak and release set the cut tempo, the choice of looks, the music mood
              per act, how dark the backgrounds get and how busy the effects are.
            </span>
          </span>
        </label>
      )}
    </SettingRow>
  );
}

/** Dramaturgy (PLAN.md#12.25-12.27): pattern interrupts, open loops, reveal moments. */
export function DramaturgyRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Dramaturgy" note={DRAMATURGY_NOTE}>
      {() => (
        <div className="project-setting-choices">
          {DRAMATURGY_CHOICES.map((choice) => (
            <label key={choice.key} className="settings-toggle">
              <input
                type="checkbox"
                checked={settings[choice.key] === 'auto'}
                onChange={(event) => {
                  update({ [choice.key]: event.target.checked ? 'auto' : 'off' });
                }}
              />
              <span>
                <strong>{choice.title}</strong>
                <span className="muted">{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </SettingRow>
  );
}

/** Editing (PLAN.md#12.21, #12.23): beat sync and repetition control. */
export function EditingRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Editing" note={EDITING_NOTE}>
      {() => (
        <div className="project-setting-choices">
          {EDITING_CHOICES.map((choice) => (
            <label key={choice.key} className="settings-toggle">
              <input
                type="checkbox"
                checked={settings[choice.key] === 'auto'}
                onChange={(event) => {
                  update({ [choice.key]: event.target.checked ? 'auto' : 'off' });
                }}
              />
              <span>
                <strong>{choice.title}</strong>
                <span className="muted">{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      )}
    </SettingRow>
  );
}

/** Scenes per minute and faster checks (ADR-027). */
export function SceneCountRow({ settings, update }: RowProps): JSX.Element {
  return (
    <SettingRow title="Scenes per minute" note={SCENE_COUNT_NOTE}>
      {() => (
        <>
          <p className="muted">{SCENE_COUNT_HINT}</p>
          <SceneCountFields
            range={settings.shotsPerMinute}
            fasterChecks={settings.fasterChecks}
            onRange={(range) => {
              update({ shotsPerMinute: range });
            }}
            onFasterChecks={(on) => {
              update({ fasterChecks: on });
            }}
          />
        </>
      )}
    </SettingRow>
  );
}

/** Sound palette per look (PLAN.md#12.24): read-only, it follows the look mode. */
export function SoundPaletteRow({ settings, looks }: RowProps): JSX.Element {
  return (
    <SettingRow title="Sound palette" note={SOUND_PALETTE_NOTE}>
      {() => <p className="option-readonly">{soundPaletteText(settings.lookMode, looks)}</p>}
    </SettingRow>
  );
}
