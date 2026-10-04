/**
 * Sources panel (PLAN.md#12.18), the Sources tab of the script view: "Check sources" (one Claude
 * turn, no web) lists the script's factual claims with the research links pinned to them; the
 * report shows how many have no source. Per claim the user attaches a link, a document or a note,
 * removes a source, confirms or disputes it. Everything lands in claims.json (tracked). The
 * research links of research.md follow below (`children`).
 */
import { useCallback, useEffect, useState, type JSX, type ReactNode } from 'react';
import type { Claim, ClaimsFile } from '@reelforge/shared';
import type { ClaimEditRequest, ClaimsState } from '../../shared/publish-contract.js';
import { errorMessage } from '../log.js';
import {
  attachRequest,
  checkButton,
  CLAIM_FILTERS,
  claimsSummary,
  claimSources,
  EMPTY_SOURCE_FORM,
  FILTER_LABELS,
  filterClaims,
  filterCount,
  SOURCE_FORM_KINDS,
  SOURCE_FORM_LABELS,
  STATUS_LABELS,
  statusActions,
  type ClaimFilter,
  type SourceForm,
} from './sources-view.js';

function AddSource(props: {
  readonly claim: Claim;
  readonly onSubmit: (request: ClaimEditRequest) => Promise<boolean>;
  readonly onCancel: () => void;
}): JSX.Element {
  const [form, setForm] = useState<SourceForm>(EMPTY_SOURCE_FORM);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <form
      className="source-form"
      aria-label={`Add a source to ${props.claim.id}`}
      onSubmit={(event) => {
        event.preventDefault();
        const built = attachRequest(props.claim.id, form);
        if ('problem' in built) {
          setProblem(built.problem);
          return;
        }
        void props.onSubmit(built.request).then((done) => {
          if (done) props.onCancel();
        });
      }}
    >
      <label>
        Kind
        <select
          value={form.kind}
          onChange={(event) => {
            const kind = SOURCE_FORM_KINDS.find((candidate) => candidate === event.target.value);
            if (kind !== undefined) setForm((current) => ({ ...current, kind }));
          }}
        >
          {SOURCE_FORM_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {SOURCE_FORM_LABELS[kind]}
            </option>
          ))}
        </select>
      </label>
      <label className="source-form-value">
        {form.kind === 'url'
          ? 'Link'
          : form.kind === 'document'
            ? 'Document (file or title)'
            : 'Note'}
        <input
          type="text"
          value={form.value}
          // The form opens on an explicit "Add source" press: focus goes to its first field.
          autoFocus
          onChange={(event) => {
            setForm((current) => ({ ...current, value: event.target.value }));
          }}
        />
      </label>
      <label>
        Name on screen (optional)
        <input
          type="text"
          maxLength={60}
          value={form.name}
          onChange={(event) => {
            setForm((current) => ({ ...current, name: event.target.value }));
          }}
        />
      </label>
      <div className="source-form-actions">
        <button type="submit" className="small-button primary">
          Add
        </button>
        <button type="button" className="small-button" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
      {problem !== null && (
        <p className="panel-error" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

function ClaimItem(props: {
  readonly file: ClaimsFile;
  readonly claim: Claim;
  readonly onEdit: (request: ClaimEditRequest) => Promise<boolean>;
}): JSX.Element {
  const { claim } = props;
  const [adding, setAdding] = useState(false);
  const sources = claimSources(props.file, claim);
  return (
    <li className={`claim claim-${claim.status}`}>
      <div className="claim-head">
        <span className={`claim-status status-${claim.status}`}>{STATUS_LABELS[claim.status]}</span>
        <span className="muted claim-meta">
          {claim.kind} · sentence {String(claim.sentence + 1)}
        </span>
      </div>
      <q className="claim-text">{claim.text}</q>
      {claim.note !== undefined && <p className="muted claim-note">{claim.note}</p>}
      {sources.length > 0 && (
        <ul className="claim-sources" aria-label={`Sources of ${claim.id}`}>
          {sources.map((source) => (
            <li key={source.id}>
              <span className="claim-source-name">{source.name}</span>
              <span className="mono muted claim-source-detail">{source.detail}</span>
              <button
                type="button"
                className="link-button"
                aria-label={`Remove source ${source.name} from ${claim.id}`}
                onClick={() => {
                  void props.onEdit({ op: 'detach', claimId: claim.id, sourceId: source.id });
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="claim-actions">
        <button
          type="button"
          className="small-button"
          aria-expanded={adding}
          onClick={() => {
            setAdding((open) => !open);
          }}
        >
          Add source
        </button>
        {statusActions(claim).map((action) => (
          <button
            key={action.label}
            type="button"
            className="small-button"
            onClick={() => {
              void props.onEdit({ op: 'status', claimId: claim.id, status: action.status });
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      {adding && (
        <AddSource
          claim={claim}
          onSubmit={props.onEdit}
          onCancel={() => {
            setAdding(false);
          }}
        />
      )}
    </li>
  );
}

function ClaimList({
  file,
  onEdit,
}: {
  readonly file: ClaimsFile;
  readonly onEdit: (request: ClaimEditRequest) => Promise<boolean>;
}): JSX.Element {
  const [filter, setFilter] = useState<ClaimFilter>('all');
  const shown = filterClaims(file, filter);
  return (
    <>
      <div className="claim-filters" role="group" aria-label="Show claims">
        {CLAIM_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            className="small-button"
            aria-pressed={filter === option}
            onClick={() => {
              setFilter(option);
            }}
          >
            {FILTER_LABELS[option]} ({String(filterCount(file, option))})
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <ol className="claim-list" aria-label="Claims">
          {shown.map((claim) => (
            <ClaimItem key={claim.id} file={file} claim={claim} onEdit={onEdit} />
          ))}
        </ol>
      )}
    </>
  );
}

export function SourcesPanel({ children }: { readonly children?: ReactNode }): JSX.Element {
  const [state, setState] = useState<ClaimsState | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<readonly string[]>([]);

  const load = useCallback(() => {
    window.reelforge.getClaimsState().then(setState, (error: unknown) => {
      setState({ status: 'error', message: errorMessage(error) });
    });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const check = (): void => {
    setBusy(true);
    setNotes([]);
    window.reelforge.checkSources().then(
      (result) => {
        setBusy(false);
        if (result.status === 'ok') {
          setState(result.state);
          setNotes(result.warnings);
        } else {
          setNotes([result.message]);
        }
      },
      (error: unknown) => {
        setBusy(false);
        setNotes([errorMessage(error)]);
      },
    );
  };
  const edit = async (request: ClaimEditRequest): Promise<boolean> => {
    try {
      const result = await window.reelforge.editClaim(request);
      if (result.status === 'error') {
        setNotes([result.message]);
        return false;
      }
      setNotes([]);
      setState(result.state);
      return true;
    } catch (error) {
      setNotes([errorMessage(error)]);
      return false;
    }
  };

  const button = checkButton(state, busy);
  const file = state?.status === 'ok' ? state.file : null;
  return (
    <section className="sources-panel" aria-labelledby="sources-title">
      <div className="sources-head">
        <h3 className="section-title" id="sources-title">
          Claims and sources
        </h3>
        <button
          type="button"
          className="small-button primary"
          aria-disabled={button.disabled}
          title={button.title}
          onClick={() => {
            if (!button.disabled) check();
          }}
        >
          {button.label}
        </button>
      </div>
      {state?.status === 'error' && <p className="panel-error">{state.message}</p>}
      {state?.status === 'ok' && state.problem !== null && (
        <p className="panel-error" role="alert">
          {state.problem}
        </p>
      )}
      {state?.status === 'ok' && state.scriptChanged && (
        <p className="publish-banner" role="status">
          The script changed since the last check: run Check again.
        </p>
      )}
      {notes.map((note) => (
        <p key={note} className="muted sources-note" role="status">
          {note}
        </p>
      ))}
      {file === null ? (
        <p className="panel-empty">
          {state?.status === 'ok' && !state.hasScript
            ? 'Write the script first, then check its sources.'
            : 'Check sources lists the facts the script states and pins the research links to them. Claude does not browse: a claim the research does not cover stays without a source.'}
        </p>
      ) : (
        <>
          <p className="sources-summary" role="status">
            {claimsSummary(file)}
          </p>
          <ClaimList file={file} onEdit={edit} />
        </>
      )}
      {children !== undefined && (
        <div className="sources-research">
          <h4 className="section-title">Research links</h4>
          {children}
        </div>
      )}
    </section>
  );
}
