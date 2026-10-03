/** Settings pages for models / Economy / budget, project defaults and performance (PLAN.md#6.7). */
import { findStylePreset, STYLE_PRESET_IDS } from '@reelforge/engine';
import {
  ENCODER_PREFERENCES,
  GPU_PREFERENCES,
  SETTINGS_MODEL_ALIASES,
  SETTINGS_STAGES,
  type AppSettingsPatch,
  type EncoderPreference,
  type GpuPreference,
  type SettingsModel,
  type SettingsStage,
} from '@reelforge/shared';
import { useState, type JSX } from 'react';
import type { SettingsState } from '../../shared/settings-contract.js';

export interface PageProps {
  readonly state: SettingsState;
  readonly update: (patch: AppSettingsPatch) => void;
}

const MODEL_LABELS: Readonly<Record<SettingsModel, string>> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

const STAGE_LABELS: Readonly<Record<SettingsStage, string>> = {
  research: 'Research',
  script: 'Script',
  storyboard: 'Storyboard',
  'scene-build': 'Scene code',
  'scene-fix': 'Scene fixes',
  critic: 'Frame critic',
  'sound-cues': 'Sound cues',
};

function isModel(value: string): value is SettingsModel {
  return (SETTINGS_MODEL_ALIASES as readonly string[]).includes(value);
}

function ModelSelect(props: {
  readonly label: string;
  readonly value: SettingsModel;
  readonly disabled: boolean;
  readonly onChange: (model: SettingsModel) => void;
}): JSX.Element {
  return (
    <label className="field">
      <span>{props.label}</span>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => {
          if (isModel(event.target.value)) props.onChange(event.target.value);
        }}
      >
        {SETTINGS_MODEL_ALIASES.map((model) => (
          <option key={model} value={model}>
            {MODEL_LABELS[model]}
          </option>
        ))}
      </select>
    </label>
  );
}

function BudgetField({ state, update }: PageProps): JSX.Element {
  const saved = state.settings.usage.softBudgetUsd;
  const [text, setText] = useState(saved === null ? '' : String(saved));
  const commit = (): void => {
    const trimmed = text.trim();
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setText(saved === null ? '' : String(saved));
      return;
    }
    if (value !== saved) update({ usage: { softBudgetUsd: value } });
  };
  return (
    <label className="field">
      <span>Soft budget per project (USD, list-price estimate; empty = none)</span>
      <input
        inputMode="decimal"
        value={text}
        placeholder="none"
        onChange={(event) => {
          setText(event.target.value);
        }}
        onBlur={commit}
      />
    </label>
  );
}

export function ModelsPage({ state, update }: PageProps): JSX.Element {
  const { settings } = state;
  return (
    <div className="settings-page">
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.economy}
          onChange={(event) => {
            update({ economy: event.target.checked });
          }}
        />
        <span>
          <strong>Economy mode</strong>
          <span className="muted">
            Every stage runs on Sonnet, turns are kept short and each shot gets one QA pass. Saves
            your Claude usage limit.
          </span>
        </span>
      </label>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={settings.scenes.finalReview}
          onChange={(event) => {
            update({ scenes: { finalReview: event.target.checked } });
          }}
        />
        <span>
          <strong>Run final review after building scenes</strong>
          <span className="muted">
            A quiet pass over every shot (sync, text size on a phone, frames) with at most one fix
            per shot; locked shots are only reported. The result is listed before export.
          </span>
        </span>
      </label>
      <h3 className="settings-heading">Model per stage</h3>
      {settings.economy && <p className="muted">Economy mode is on: all stages use Sonnet.</p>}
      <div className="settings-grid">
        {SETTINGS_STAGES.map((stage) => (
          <ModelSelect
            key={stage}
            label={STAGE_LABELS[stage]}
            value={settings.models[stage]}
            disabled={settings.economy}
            onChange={(model) => {
              update({ models: { [stage]: model } });
            }}
          />
        ))}
      </div>
      <h3 className="settings-heading">Edit chat</h3>
      <div className="settings-grid">
        <ModelSelect
          label="Chat"
          value={settings.chat.model}
          disabled={settings.economy}
          onChange={(model) => {
            update({ chat: { model } });
          }}
        />
        <ModelSelect
          label='"Harder fix" toggle'
          value={settings.chat.boostModel}
          disabled={settings.economy}
          onChange={(model) => {
            update({ chat: { boostModel: model } });
          }}
        />
      </div>
      <h3 className="settings-heading">Usage</h3>
      <BudgetField state={state} update={update} />
    </div>
  );
}

export function ProjectsPage({ state, update }: PageProps): JSX.Element {
  const { settings } = state;
  return (
    <div className="settings-page">
      <p className="muted">Defaults for new projects. Open projects keep their own choices.</p>
      <div className="settings-grid">
        <label className="field">
          <span>Video language</span>
          <select
            value={settings.language}
            onChange={(event) => {
              update({ language: event.target.value === 'pl' ? 'pl' : 'en' });
            }}
          >
            <option value="en">English</option>
            <option value="pl">Polski</option>
          </select>
        </label>
        <label className="field">
          <span>Style</span>
          <select
            value={settings.defaultStyle}
            onChange={(event) => {
              update({ defaultStyle: event.target.value });
            }}
          >
            {STYLE_PRESET_IDS.map((id) => (
              <option key={id} value={id}>
                {findStylePreset(id)?.name ?? id}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Theme</span>
          <select value="dark" disabled>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>
    </div>
  );
}

const ENCODER_LABELS: Readonly<Record<EncoderPreference, string>> = {
  auto: 'Auto (GPU first, then CPU)',
  nvenc: 'NVIDIA NVENC',
  qsv: 'Intel Quick Sync',
  amf: 'AMD AMF',
  cpu: 'CPU (libx264)',
};

const GPU_LABELS: Readonly<Record<GpuPreference, string>> = {
  auto: 'Let the system decide',
  'high-performance': 'High-performance GPU',
  'low-power': 'Power-saving GPU',
};

export function PerformancePage({ state, update }: PageProps): JSX.Element {
  const { settings, cores } = state;
  const autoWorkers = Math.max(1, Math.floor(cores / 2));
  const workerChoices = Array.from({ length: cores }, (_, index) => index + 1);
  return (
    <div className="settings-page">
      <div className="settings-grid">
        <label className="field">
          <span>Export render workers</span>
          <select
            value={String(settings.performance.exportWorkers)}
            onChange={(event) => {
              const value = event.target.value;
              update({ performance: { exportWorkers: value === 'auto' ? 'auto' : Number(value) } });
            }}
          >
            <option value="auto">
              Auto ({autoWorkers} of {cores} cores)
            </option>
            {workerChoices.map((count) => (
              <option key={count} value={String(count)}>
                {count}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Video encoder</span>
          <select
            value={settings.performance.encoder}
            onChange={(event) => {
              const value = ENCODER_PREFERENCES.find((id) => id === event.target.value);
              if (value !== undefined) update({ performance: { encoder: value } });
            }}
          >
            {ENCODER_PREFERENCES.map((id) => (
              <option key={id} value={id}>
                {ENCODER_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>GPU for preview and rendering</span>
          <select
            value={settings.performance.gpu}
            onChange={(event) => {
              const value = GPU_PREFERENCES.find((id) => id === event.target.value);
              if (value !== undefined) update({ performance: { gpu: value } });
            }}
          >
            {GPU_PREFERENCES.map((id) => (
              <option key={id} value={id}>
                {GPU_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        A hardware encoder that fails its test encode falls back to the CPU. The GPU choice applies
        after restarting ReelForge.
      </p>
    </div>
  );
}
