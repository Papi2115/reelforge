/**
 * Hook lab (PLAN.md#12.16) in the Script step: "Hook lab…" opens a dialog where Claude writes three
 * alternative openings (cold open, question, shocking fact) shown next to the current one with
 * their length, first-visual idea, source flag and changes; "Use this opening" says what it means
 * (re-record, locked shots kept, later steps out of date) and replaces the opening on confirm.
 * Keys: 1/2/3 choose a variant, Escape closes.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { HookLabView } from '../../shared/hook-lab-contract.js';
import { labPhase, openingCards, pickConsequences, type OpeningCard } from './hook-lab-view.js';
import { useHookLab, type HookLabNotice } from './use-hook-lab.js';

function Diff({ card }: { readonly card: OpeningCard }): JSX.Element {
  return (
    <details className="hook-diff">
      <summary>Changes against the current opening</summary>
      <p>
        {card.diff.map((token, position) =>
          token.kind === 'same' ? (
            <span key={position}>{token.text} </span>
          ) : token.kind === 'added' ? (
            <ins key={position}>{token.text} </ins>
          ) : (
            <del key={position}>{token.text} </del>
          ),
        )}
      </p>
    </details>
  );
}

function Card(props: {
  readonly card: OpeningCard;
  readonly disabled: boolean;
  readonly onUse: () => void;
}): JSX.Element {
  const { card } = props;
  return (
    <article className={`hook-card${card.index === 0 ? ' current' : ''}`} aria-label={card.title}>
      <header className="hook-card-head">
        <h3>{card.title}</h3>
        <span className="muted">
          {card.words} words · {card.duration}
        </span>
      </header>
      <p className="hook-text">{card.text}</p>
      {card.firstVisual !== null && (
        <p className="hook-visual">
          <span className="muted">First visual:</span> {card.firstVisual}
        </p>
      )}
      {card.needsSource && (
        <p className="hook-source">States a fact or number: check its source (Sources tab).</p>
      )}
      {card.index > 0 && <Diff card={card} />}
      {card.index > 0 && (
        <button type="button" className="primary" disabled={props.disabled} onClick={props.onUse}>
          Use this opening
        </button>
      )}
    </article>
  );
}

function Confirm(props: {
  readonly view: HookLabView;
  readonly card: OpeningCard;
  readonly working: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}): JSX.Element {
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirm.current?.focus();
  }, []);
  return (
    <section className="hook-confirm" aria-label="Replace the opening" role="group">
      <h3>Use “{props.card.title}” as the opening?</h3>
      <ul>
        {pickConsequences(props.view).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="modal-actions">
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          ref={confirm}
          type="button"
          className="primary"
          disabled={props.working}
          onClick={props.onConfirm}
        >
          Replace the opening
        </button>
      </div>
    </section>
  );
}

function Notice({ notice }: { readonly notice: HookLabNotice }): JSX.Element {
  return (
    <div className={notice.error ? 'doc-banner panel-error' : 'hook-notice'} role="status">
      {notice.message !== null && <p>{notice.message}</p>}
      {notice.warnings.length > 0 && (
        <ul>
          {notice.warnings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PhaseBody(props: {
  readonly view: HookLabView;
  readonly working: boolean;
  readonly selected: number | null;
  readonly onSelect: (index: number | null) => void;
  readonly onGenerate: () => void;
  readonly onPick: (number: number, index: number) => void;
  readonly onDiscard: (number: number) => void;
}): JSX.Element {
  const phase = labPhase(props.view);
  const write = (label: string): JSX.Element => (
    <button type="button" className="primary" disabled={props.working} onClick={props.onGenerate}>
      {label}
    </button>
  );
  switch (phase.kind) {
    case 'no-script':
      return <p className="panel-empty">Write or import a script first.</p>;
    case 'busy':
      return <p className="panel-empty">The script is being written: the lab waits for it.</p>;
    case 'generating':
      return <p className="panel-empty">Claude is writing three openings… (no web, read only)</p>;
    case 'empty':
      return (
        <div className="hook-empty">
          <p>
            Claude writes three alternative openings from your script — a cold open, a question and
            a shocking fact — to compare with the current one. Only the opening paragraph can
            change; nothing changes until you choose.
          </p>
          {write(phase.history === 0 ? 'Write three openings' : 'Write new openings')}
        </div>
      );
    case 'stale':
      return (
        <div className="hook-empty">
          <p>The opening changed since these openings were written.</p>
          {write('Write new openings')}
        </div>
      );
    case 'compare': {
      const cards = openingCards(phase.opening, phase.set);
      const chosen = cards.find((card) => card.index === props.selected && card.index > 0);
      if (chosen !== undefined) {
        return (
          <Confirm
            view={props.view}
            card={chosen}
            working={props.working}
            onCancel={() => {
              props.onSelect(null);
            }}
            onConfirm={() => {
              props.onPick(phase.set.number, chosen.index);
            }}
          />
        );
      }
      return (
        <>
          {phase.set.warnings.length > 0 && (
            <p className="muted">Checks: {phase.set.warnings.join(' · ')}</p>
          )}
          <div className="hook-grid">
            {cards.map((card) => (
              <Card
                key={card.index}
                card={card}
                disabled={props.working}
                onUse={() => {
                  props.onSelect(card.index);
                }}
              />
            ))}
          </div>
          <div className="modal-actions">
            <button
              type="button"
              disabled={props.working}
              onClick={() => {
                props.onDiscard(phase.set.number);
              }}
            >
              Keep the current opening
            </button>
            {write('Write new openings')}
          </div>
        </>
      );
    }
  }
}

export function HookLabDialog(props: { readonly onClose: () => void }): JSX.Element {
  const lab = useHookLab();
  const [selected, setSelected] = useState<number | null>(null);
  const { onClose } = props;
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialog.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (selected === null) onClose();
        else setSelected(null);
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (/^[1-3]$/.test(event.key) && lab.view !== undefined) {
        if (labPhase(lab.view).kind === 'compare') setSelected(Number(event.key));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [lab.view, onClose, selected]);

  return (
    <div className="modal-backdrop">
      <div
        ref={dialog}
        className="hook-lab"
        role="dialog"
        aria-modal="true"
        aria-label="Hook lab"
        tabIndex={-1}
      >
        <header className="hook-lab-head">
          <h2 className="modal-title">Hook lab</h2>
          <span className="muted">Three ways to open the film · keys 1–3</span>
          <button type="button" className="small-button" onClick={onClose}>
            Close
          </button>
        </header>
        {lab.notice !== null && <Notice notice={lab.notice} />}
        {lab.view === undefined ? (
          <p className="panel-empty">Reading the script…</p>
        ) : (
          <PhaseBody
            view={lab.view}
            working={lab.working}
            selected={selected}
            onSelect={setSelected}
            onGenerate={lab.generate}
            onPick={(number, index) => {
              void lab.pick(number, index).then(() => {
                setSelected(null);
              });
            }}
            onDiscard={lab.discard}
          />
        )}
      </div>
    </div>
  );
}

/** The Script tab's entry point. */
export function HookLabButton(props: { readonly disabled: boolean }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="small-button"
        disabled={props.disabled}
        title="Compare three alternative openings of the film"
        onClick={() => {
          setOpen(true);
        }}
      >
        Hook lab…
      </button>
      {open && (
        <HookLabDialog
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
