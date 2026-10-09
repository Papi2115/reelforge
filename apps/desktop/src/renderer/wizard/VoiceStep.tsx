/**
 * New project wizard → step 4 "Voice and create" (PLAN.md#13.16): how the voice gets made
 * (ElevenLabs when the channel has a voice and a key, record / import, or later), "More options"
 * (the film's language, scenes per minute and faster checks of the old form) and the review.
 */
import { useId, type JSX } from 'react';
import type { ShotsPerMinute } from '@reelforge/shared';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { Disclosure } from '../layout/Disclosure.js';
import { SceneCountFields } from '../project/SceneCountFields.js';
import { SCENE_COUNT_HINT } from '../project/scene-count-view.js';
import type { VoiceOption, VoicePlan } from './wizard-view.js';

type Language = ProjectSummary['language'];

export interface VoiceStepProps {
  readonly options: readonly VoiceOption[];
  readonly voice: VoicePlan;
  readonly onVoice: (voice: VoicePlan) => void;
  readonly moreOpen: boolean;
  readonly onMoreOpen: (open: boolean) => void;
  readonly language: Language;
  readonly onLanguage: (language: Language) => void;
  readonly shotsPerMinute: ShotsPerMinute | null;
  readonly fasterChecks: boolean;
  readonly onShotsPerMinute: (range: ShotsPerMinute | null) => void;
  readonly onFasterChecks: (on: boolean) => void;
  readonly review: readonly (readonly [string, string])[];
  readonly disabled: boolean;
}

export function VoiceStep(props: VoiceStepProps): JSX.Element {
  const name = useId();
  return (
    <div className="wizard-fields">
      <fieldset className="wizard-voice">
        <legend>Voice</legend>
        {props.options.map((option) => (
          <label
            key={option.id}
            className="settings-toggle"
            title={option.unavailable}
            aria-disabled={option.unavailable !== undefined}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={props.voice === option.id}
              disabled={props.disabled || option.unavailable !== undefined}
              onChange={() => {
                props.onVoice(option.id);
              }}
            />
            <span>
              <strong>{option.label}</strong>
              <span className="muted">{option.unavailable ?? option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Disclosure
        title="More options"
        summary="language, scenes per minute, faster checks"
        open={props.moreOpen}
        onToggle={props.onMoreOpen}
        className="wizard-more"
      >
        <label className="field">
          <span>Language</span>
          <select
            value={props.language}
            disabled={props.disabled}
            onChange={(event) => {
              props.onLanguage(event.target.value === 'pl' ? 'pl' : 'en');
            }}
          >
            <option value="en">English</option>
            <option value="pl">Polski</option>
          </select>
        </label>
        <fieldset className="start-scene-count">
          <legend>Scenes and checks</legend>
          <p className="muted">{SCENE_COUNT_HINT}</p>
          <SceneCountFields
            range={props.shotsPerMinute}
            fasterChecks={props.fasterChecks}
            onRange={props.onShotsPerMinute}
            onFasterChecks={props.onFasterChecks}
            disabled={props.disabled}
          />
        </fieldset>
      </Disclosure>
      <section className="wizard-review" aria-label="Review">
        <h3 className="section-title">Review</h3>
        <dl>
          {props.review.map(([label, value]) => (
            <div key={label} className="wizard-review-row">
              <dt className="muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="muted wizard-note">
          Next you choose the folder the project is saved in. Then the editor opens on the script.
        </p>
      </section>
    </div>
  );
}
