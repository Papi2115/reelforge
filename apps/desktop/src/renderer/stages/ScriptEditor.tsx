/**
 * The script editor (PLAN.md#7.1): plain monospace text, autosaved to script.txt a moment after
 * typing stops (main commits the edits), a live word counter and duration estimate at 150 wpm
 * against the brief's target (green within ±15 %, amber, red), and the acceptance gate.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { estimateLine, scriptEstimate } from '../../shared/script-stats.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('script');

export const AUTOSAVE_DELAY_MS = 700;

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

const SAVE_TEXT: Readonly<Record<SaveState, string>> = {
  saved: 'Saved',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
  error: 'Not saved',
};

export interface ScriptEditorProps {
  /** Text on disk (null: no script.txt yet). */
  readonly script: string | null;
  readonly targetMinutes: number | null;
  readonly approvedAt: string | null;
  readonly readOnly: boolean;
  readonly onApprove: () => Promise<string | null>;
}

export function ScriptEditor(props: ScriptEditorProps): JSX.Element {
  const [text, setText] = useState(props.script ?? '');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const saved = useRef(props.script ?? '');
  const latest = useRef(text);
  latest.current = text;

  // A new version on disk (the stage finished, an import) replaces the text unless it was edited.
  useEffect(() => {
    const disk = props.script ?? '';
    if (latest.current === saved.current) setText(disk);
    saved.current = disk;
  }, [props.script]);

  useEffect(() => {
    if (text === saved.current || props.readOnly) return;
    setSaveState('unsaved');
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      window.reelforge.saveScript(text).then(
        (result) => {
          if (result.status === 'error') {
            setSaveState('error');
            setProblem(result.message ?? 'script.txt was not saved.');
            return;
          }
          saved.current = text;
          setProblem(result.message ?? undefined);
          setSaveState(latest.current === text ? 'saved' : 'unsaved');
        },
        (error: unknown) => {
          log.error(`saveScript failed: ${errorMessage(error)}`);
          setSaveState('error');
          setProblem(errorMessage(error));
        },
      );
    }, AUTOSAVE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [text, props.readOnly]);

  const estimate = scriptEstimate(text, props.targetMinutes);
  const empty = text.trim() === '';
  const approved = props.approvedAt !== null;

  return (
    <div className="script-editor">
      <textarea
        className="script-text mono"
        aria-label="Script"
        value={text}
        readOnly={props.readOnly}
        spellCheck
        placeholder="No script yet. Fill in the brief and press Write script, or paste your own script here: spoken words only, no headings or stage directions."
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      <div className="script-footer">
        <span
          className={`script-estimate verdict-${estimate.verdict}`}
          data-testid="script-estimate"
          title="Words a speaker says, at 150 words per minute, against the brief's target (±15 % is fine)"
        >
          {estimateLine(estimate)}
        </span>
        <span className={`script-save save-${saveState}`} aria-live="polite">
          {SAVE_TEXT[saveState]}
        </span>
        {approved ? (
          <span className="chip approved-chip" title={`Approved ${props.approvedAt}`}>
            Approved ✓
          </span>
        ) : (
          <button
            type="button"
            className="small-button primary"
            disabled={empty || props.readOnly || saveState !== 'saved'}
            title={
              empty
                ? 'Write or paste a script first'
                : 'Later steps (words, storyboard, scenes) use the approved script'
            }
            onClick={() => {
              setProblem(undefined);
              void props.onApprove().then((failure) => {
                if (failure !== null) setProblem(failure);
              });
            }}
          >
            Approve script
          </button>
        )}
      </div>
      {problem !== undefined && (
        <p className={saveState === 'error' ? 'panel-error' : 'muted'} role="status">
          {problem}
        </p>
      )}
    </div>
  );
}
