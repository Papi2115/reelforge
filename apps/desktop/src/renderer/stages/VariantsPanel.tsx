/**
 * Variants of one shot (PLAN.md#11.3), docked under the preview: the "Variants…" form when there
 * is no set, the generation progress (per variant, with Stop), then the current scene and the
 * 2–3 variants as cards in one row (VariantCardView) — "Play in preview" plays a card's scene in
 * the main player with the project audio — and the decisions in the header: Lock after picking,
 * Keep current, Discard all, New set…. Keys: 1/2/3 select a variant, arrows move, Enter picks.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { StageRunView } from '../../shared/stages-contract.js';
import type {
  VariantCard,
  VariantKey,
  VariantOpRequest,
  VariantSetView,
} from '../../shared/variants-contract.js';
import { StopIcon } from '../layout/icons.js';
import { keyTargetOf } from '../preview/transport-keys.js';
import type { StagesControls } from './use-stages.js';
import type { VariantsControls } from './use-variants.js';
import type { VariantsDock } from './use-variants-dock.js';
import { VariantCardView } from './VariantCardView.js';
import { VariantSetup } from './VariantSetup.js';
import {
  cardKeyAction,
  defaultVariantCount,
  scenesBusy,
  setOf,
  variantIndex,
  variantsProgressText,
  variantsRun,
} from './variants-view.js';

export interface VariantsPanelProps {
  readonly shotId: string;
  readonly set: VariantSetView | undefined;
  readonly locked: boolean;
  /** Scenes built runs or waits (another shot, a build). */
  readonly busy: boolean;
  /** The run on this shot's variants, if any. */
  readonly run: StageRunView | null;
  readonly controls: VariantsControls;
  /** The card playing in the main preview (null = none). */
  readonly previewing: VariantKey | null;
  readonly onPreview: (key: VariantKey | null) => void;
  /** The last Scenes built failure (shown when a generation ended without variants). */
  readonly scenesError: string | null;
  readonly onStop: () => void;
  readonly onClose: () => void;
}

function Decisions(props: {
  readonly blocked: string | null;
  readonly lockAfter: boolean;
  readonly onLockAfter: (lock: boolean) => void;
  readonly onDecide: (op: VariantOpRequest) => void;
  readonly onNewSet: () => void;
}): JSX.Element {
  const { blocked } = props;
  const button = (label: string, title: string, action: () => void) => (
    <button
      type="button"
      className="small-button"
      aria-disabled={blocked !== null}
      title={blocked ?? title}
      onClick={() => {
        if (blocked === null) action();
      }}
    >
      {label}
    </button>
  );
  return (
    <>
      <label className="variant-lock" title="Lock the shot right after picking a variant">
        <input
          type="checkbox"
          checked={props.lockAfter}
          onChange={(event) => {
            props.onLockAfter(event.target.checked);
          }}
        />
        Lock after picking
      </label>
      {button('Keep current', 'Keep the current scene and drop the variants', () => {
        props.onDecide({ kind: 'keep-current' });
      })}
      {button('Discard all', 'Delete every variant of this shot', () => {
        props.onDecide({ kind: 'discard' });
      })}
      {button('New set…', 'Replace these variants with a new set (new directions)', props.onNewSet)}
    </>
  );
}

export function VariantsPanel(props: VariantsPanelProps): JSX.Element {
  const { shotId, set, controls, run, onClose } = props;
  const rootRef = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(1);
  const [lockAfter, setLockAfter] = useState(false);
  const [setup, setSetup] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** The last operation sent from this view (closing after a decision, failure notes). */
  const [sent, setSent] = useState<'generate' | 'decision' | null>(null);
  const [sawRun, setSawRun] = useState(false);
  const cards = set?.cards ?? [];
  const blocked = props.locked
    ? 'Shot is locked — unlock first'
    : props.busy
      ? 'Scenes built is running or queued.'
      : null;
  const settled = run === null && set === undefined;
  const showSetup = settled || setup;

  useEffect(() => {
    rootRef.current?.focus();
  }, [shotId]);
  useEffect(() => {
    if (run !== null) setSawRun(true);
  }, [run]);
  useEffect(() => {
    if (settled && sent === 'decision') onClose();
  }, [settled, sent, onClose]);

  const send = (op: VariantOpRequest): void => {
    setNotice(null);
    setSent(op.kind === 'generate' ? 'generate' : 'decision');
    setSawRun(false);
    if (op.kind !== 'generate') props.onPreview(null);
    void controls.run(shotId, op).then((result) => {
      if (result.status === 'error') setNotice(result.message ?? 'Not started.');
      else if (op.kind === 'generate') setSetup(false);
    });
  };
  const pick = (card: VariantCard | undefined): void => {
    const index = card === undefined ? undefined : variantIndex(card);
    if (index !== undefined && blocked === null) send({ kind: 'pick', index, lock: lockAfter });
  };

  return (
    <section
      ref={rootRef}
      tabIndex={-1}
      className="doc-panel docked variants-panel"
      aria-label={`Variants of ${shotId}`}
      onKeyDown={(event) => {
        if (showSetup) return;
        const action = cardKeyAction(
          {
            key: event.key,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            repeat: event.repeat,
            target: keyTargetOf(event.target),
          },
          cards,
          selected,
        );
        if (action === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        if (action.kind === 'select') setSelected(action.index);
        else pick(cards[selected]);
      }}
    >
      <div className="doc-header variants-header">
        <h2 className="doc-title">Variants · {shotId}</h2>
        {set?.note !== null && set?.note !== undefined && (
          <span className="variant-set-note" title={set.note}>
            “{set.note}”
          </span>
        )}
        <span className="variants-header-actions">
          {!showSetup && run === null && (
            <Decisions
              blocked={blocked}
              lockAfter={lockAfter}
              onLockAfter={setLockAfter}
              onDecide={send}
              onNewSet={() => {
                setSetup(true);
              }}
            />
          )}
          <button
            type="button"
            className="small-button"
            onClick={() => {
              props.onPreview(null);
              onClose();
            }}
          >
            Back to preview
          </button>
        </span>
      </div>
      <div className="doc-body">
        {notice !== null && (
          <p className="panel-error" role="alert">
            {notice}
          </p>
        )}
        {settled && sawRun && sent === 'generate' && props.scenesError !== null && (
          <p className="panel-error" role="alert">
            {props.scenesError}
          </p>
        )}
        {run !== null && (
          <div className="variant-progress" aria-live="polite">
            <span>{variantsProgressText(run, set)}</span>
            {run.paused !== null && <span className="muted"> · {run.paused.message}</span>}
            <button type="button" className="small-button" onClick={props.onStop}>
              <StopIcon />
              Stop
            </button>
          </div>
        )}
        {showSetup ? (
          <VariantSetup
            shotId={shotId}
            defaultCount={defaultVariantCount(controls.economy)}
            blocked={blocked}
            estimate={controls.estimate}
            onGenerate={(count, note) => {
              send({ kind: 'generate', count, ...(note === '' ? {} : { note }) });
            }}
            onCancel={
              set === undefined
                ? undefined
                : () => {
                    setSetup(false);
                  }
            }
          />
        ) : (
          <ul
            className="variant-cards"
            aria-label="Variant cards"
            style={{
              gridTemplateColumns: `repeat(${String(Math.max(1, cards.length))}, minmax(0, 1fr))`,
            }}
          >
            {cards.map((card, index) => (
              <VariantCardView
                key={card.key}
                shotId={shotId}
                card={card}
                selected={index === selected}
                previewing={props.previewing === card.key}
                blocked={blocked}
                onSelect={() => {
                  setSelected(index);
                }}
                onPreview={() => {
                  props.onPreview(props.previewing === card.key ? null : card.key);
                }}
                onPick={() => {
                  pick(card);
                }}
                onRegenerate={() => {
                  const only = variantIndex(card);
                  if (only !== undefined) send({ kind: 'generate', count: 3, only });
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The Variants dock of the workspace (nothing while it is closed). */
export function VariantsDockPanel(props: {
  readonly dock: VariantsDock;
  readonly stages: StagesControls;
  readonly locked: ReadonlySet<string>;
}): JSX.Element | null {
  const { dock, stages } = props;
  if (dock.shotId === null) return null;
  const state = stages.state;
  return (
    <VariantsPanel
      shotId={dock.shotId}
      set={setOf(dock.controls.state, dock.shotId)}
      locked={props.locked.has(dock.shotId)}
      busy={scenesBusy(state)}
      run={variantsRun(state?.running, dock.shotId)}
      controls={dock.controls}
      previewing={dock.previewKey}
      onPreview={dock.setPreview}
      scenesError={state?.stages.find((info) => info.stage === 'scenes')?.error?.message ?? null}
      onStop={() => {
        stages.stop('scenes');
      }}
      onClose={dock.close}
    />
  );
}
