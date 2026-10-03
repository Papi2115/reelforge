/**
 * "Variants…" form (PLAN.md#11.3): 2 or 3 variants (default 3, Economy 2), an optional note that
 * goes into every variant prompt, and the cost estimate from the usage ledger before generating.
 */
import { useEffect, useState, type JSX } from 'react';
import {
  MAX_VARIANT_NOTE,
  type VariantCount,
  type VariantEstimateView,
} from '../../shared/variants-contract.js';

export interface VariantSetupProps {
  readonly shotId: string;
  readonly defaultCount: VariantCount;
  /** Why generating is not possible now (locked, Scenes built busy), null = possible. */
  readonly blocked: string | null;
  readonly estimate: (count: VariantCount) => Promise<VariantEstimateView | undefined>;
  readonly onGenerate: (count: VariantCount, note: string) => void;
  /** Back to the current set (shown when one exists). */
  readonly onCancel?: (() => void) | undefined;
}

export function VariantSetup(props: VariantSetupProps): JSX.Element {
  const { estimate, blocked } = props;
  const [count, setCount] = useState<VariantCount>(props.defaultCount);
  const [note, setNote] = useState('');
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    setCount(props.defaultCount);
  }, [props.defaultCount]);

  useEffect(() => {
    let active = true;
    setCost(null);
    void estimate(count).then((result) => {
      if (active) setCost(result?.text ?? null);
    });
    return () => {
      active = false;
    };
  }, [count, estimate]);

  return (
    <form
      className="variant-setup"
      aria-label={`New variants of ${props.shotId}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (blocked === null) props.onGenerate(count, note.trim());
      }}
    >
      <p className="muted">
        Claude builds {count} genuinely different versions of {props.shotId}, each from its own
        creative direction; the current scene stays until you pick one.
      </p>
      <div className="variant-setup-row">
        <fieldset className="variant-count">
          <legend>Variants</legend>
          {([2, 3] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="variant-count"
                checked={count === value}
                onChange={() => {
                  setCount(value);
                }}
              />
              {value}
            </label>
          ))}
        </fieldset>
        <label className="variant-note">
          Note for every variant (optional)
          <input
            type="text"
            value={note}
            maxLength={MAX_VARIANT_NOTE}
            placeholder="e.g. make it calmer · more dramatic camera"
            onChange={(event) => {
              setNote(event.target.value);
            }}
          />
        </label>
      </div>
      {blocked !== null && (
        <p className="panel-error" role="alert">
          {blocked}
        </p>
      )}
      <div className="variant-setup-row">
        <p className="variant-estimate" data-testid="variant-estimate">
          {cost ?? 'Estimating…'}
        </p>
        <button type="submit" className="small-button primary" aria-disabled={blocked !== null}>
          Generate {count} variants
        </button>
        {props.onCancel !== undefined && (
          <button type="button" className="small-button" onClick={props.onCancel}>
            Back to the variants
          </button>
        )}
      </div>
    </form>
  );
}
