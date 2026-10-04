/**
 * Scenes per minute (preset or custom from–to) and the faster-checks switch with a live estimate
 * (ADR-027). Controlled: the parent keeps the values (New project form, Project settings,
 * Settings → Projects).
 */
import type { ShotsPerMinute } from '@reelforge/shared';
import { useEffect, useState, type JSX } from 'react';
import {
  FASTER_CHECKS_HINT,
  FASTER_CHECKS_TITLE,
  isShotRangeChoice,
  parseCustomRange,
  rangeForChoice,
  sceneCountEstimateLine,
  SHOT_RANGE_OPTIONS,
  shotRangeChoice,
} from './scene-count-view.js';

export interface SceneCountFieldsProps {
  readonly range: ShotsPerMinute | null;
  readonly fasterChecks: boolean;
  readonly onRange: (range: ShotsPerMinute | null) => void;
  readonly onFasterChecks: (on: boolean) => void;
  readonly disabled?: boolean;
}

export function SceneCountFields(props: SceneCountFieldsProps): JSX.Element {
  const { range, fasterChecks, disabled = false } = props;
  const [custom, setCustom] = useState(shotRangeChoice(range) === 'custom');
  const [fromText, setFromText] = useState(range === null ? '' : String(range.min));
  const [toText, setToText] = useState(range === null ? '' : String(range.max));
  useEffect(() => {
    if (range === null) return;
    setFromText(String(range.min));
    setToText(String(range.max));
  }, [range]);
  const choice = custom ? 'custom' : shotRangeChoice(range);
  const parsed = parseCustomRange(fromText, toText);
  const editCustom = (from: string, to: string): void => {
    setFromText(from);
    setToText(to);
    const next = parseCustomRange(from, to);
    if (next.ok) props.onRange(next.range);
  };
  return (
    <div className="scene-count-fields">
      <label className="field">
        <span>Scenes per minute</span>
        <select
          value={choice}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value;
            if (!isShotRangeChoice(value)) return;
            setCustom(value === 'custom');
            props.onRange(rangeForChoice(value, range));
          }}
        >
          {SHOT_RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {choice === 'custom' && (
        <div className="scene-count-custom">
          <label className="field">
            <span>From</span>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={fromText}
              disabled={disabled}
              aria-label="Scenes per minute from"
              onChange={(event) => {
                editCustom(event.target.value, toText);
              }}
            />
          </label>
          <label className="field">
            <span>To</span>
            <input
              type="number"
              min={1}
              max={20}
              step={0.5}
              value={toText}
              disabled={disabled}
              aria-label="Scenes per minute to"
              onChange={(event) => {
                editCustom(fromText, event.target.value);
              }}
            />
          </label>
          {!parsed.ok && <span className="research-warning">{parsed.message}</span>}
        </div>
      )}
      <p className="muted scene-count-estimate" role="status">
        {sceneCountEstimateLine(range, fasterChecks)}
      </p>
      <label className="settings-toggle">
        <input
          type="checkbox"
          checked={fasterChecks}
          disabled={disabled}
          onChange={(event) => {
            props.onFasterChecks(event.target.checked);
          }}
        />
        <span>
          <strong>{FASTER_CHECKS_TITLE}</strong>
          <span className="muted">{FASTER_CHECKS_HINT}</span>
        </span>
      </label>
    </div>
  );
}
