/**
 * The brief (PLAN.md#7.1): topic, target length, tone, audience, language and notes, saved to
 * brief.json; "Write script" saves it and queues the Script stage (research -> beats -> script).
 * Rewriting an existing script asks first.
 */
import { useEffect, useState, type JSX, type SyntheticEvent } from 'react';
import type { ProjectSummary } from '../../shared/project-contract.js';
import type { BriefInput, StageCommandResult } from '../../shared/stages-contract.js';
import { errorMessage, rendererLog } from '../log.js';
import { ConfirmDialog } from '../project/ConfirmDialog.js';

const log = rendererLog('brief');

export const DEFAULT_TARGET_MINUTES = 5;

export interface BriefFormProps {
  readonly project: ProjectSummary;
  /** The script stage runs or waits: the brief is read-only meanwhile. */
  readonly busy: boolean;
  readonly hasScript: boolean;
  readonly onWriteScript: () => Promise<StageCommandResult>;
  /** After "Write script" was queued. */
  readonly onStarted: () => void;
}

interface Fields {
  readonly topic: string;
  readonly minutes: string;
  readonly tone: string;
  readonly audience: string;
  readonly language: ProjectSummary['language'];
  readonly notes: string;
}

function toInput(fields: Fields): BriefInput | string {
  const targetMinutes = Number(fields.minutes);
  if (fields.topic.trim() === '') return 'Describe what the video is about.';
  if (!Number.isFinite(targetMinutes) || targetMinutes <= 0 || targetMinutes > 60) {
    return 'The target length must be between 0.5 and 60 minutes.';
  }
  return {
    topic: fields.topic,
    language: fields.language,
    targetMinutes,
    tone: fields.tone,
    audience: fields.audience,
    notes: fields.notes,
  };
}

export function BriefForm(props: BriefFormProps): JSX.Element {
  const [fields, setFields] = useState<Fields>({
    topic: '',
    minutes: String(DEFAULT_TARGET_MINUTES),
    tone: '',
    audience: '',
    language: props.project.language,
    notes: '',
  });
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | undefined>();
  const [saving, setSaving] = useState(false);
  const [confirmRewrite, setConfirmRewrite] = useState(false);

  useEffect(() => {
    let active = true;
    window.reelforge.getBrief().then(
      (result) => {
        if (!active) return;
        const brief = result.brief;
        if (brief !== null) {
          setFields({
            topic: brief.topic,
            minutes: String(brief.targetMinutes ?? DEFAULT_TARGET_MINUTES),
            tone: brief.tone ?? '',
            audience: brief.audience ?? '',
            language: brief.language,
            notes: brief.notes ?? '',
          });
        }
        if (result.error !== null) setMessage({ error: true, text: result.error });
        setLoaded(true);
      },
      (error: unknown) => {
        log.error(`getBrief failed: ${errorMessage(error)}`);
        if (active) setLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const set = (patch: Partial<Fields>): void => {
    setFields((current) => ({ ...current, ...patch }));
    setMessage(undefined);
  };

  const save = async (): Promise<boolean> => {
    const input = toInput(fields);
    if (typeof input === 'string') {
      setMessage({ error: true, text: input });
      return false;
    }
    const saved = await window.reelforge.saveBrief(input);
    if (saved.status === 'error') {
      setMessage({ error: true, text: saved.message ?? 'The brief was not saved.' });
      return false;
    }
    return true;
  };

  const act = (write: boolean): void => {
    setSaving(true);
    setMessage(undefined);
    void (async () => {
      try {
        if (!(await save())) return;
        if (!write) {
          setMessage({ error: false, text: 'Brief saved.' });
          return;
        }
        const queued = await props.onWriteScript();
        if (queued.status === 'error') {
          setMessage({ error: true, text: queued.message ?? 'The script could not start.' });
          return;
        }
        props.onStarted();
      } catch (error) {
        log.error(`brief action failed: ${errorMessage(error)}`);
        setMessage({ error: true, text: errorMessage(error) });
      } finally {
        setSaving(false);
      }
    })();
  };

  const submit = (event: SyntheticEvent): void => {
    event.preventDefault();
    if (props.hasScript) setConfirmRewrite(true);
    else act(true);
  };

  const disabled = props.busy || saving || !loaded;
  return (
    <form className="brief-form" aria-label="Brief" onSubmit={submit}>
      <label className="field brief-topic">
        <span>What is the video about? (a few sentences)</span>
        <textarea
          value={fields.topic}
          rows={4}
          maxLength={4000}
          disabled={disabled}
          placeholder="How a graphing calculator with 61 KB of memory ends up running Doom, and what that says about how small games used to be."
          onChange={(event) => {
            set({ topic: event.target.value });
          }}
        />
      </label>
      <div className="brief-row">
        <label className="field">
          <span>Target length (minutes)</span>
          <input
            type="number"
            min={0.5}
            max={60}
            step={0.5}
            value={fields.minutes}
            disabled={disabled}
            onChange={(event) => {
              set({ minutes: event.target.value });
            }}
          />
        </label>
        <label className="field">
          <span>Language</span>
          <select
            value={fields.language}
            disabled={disabled}
            onChange={(event) => {
              set({ language: event.target.value === 'pl' ? 'pl' : 'en' });
            }}
          >
            <option value="en">English</option>
            <option value="pl">Polski</option>
          </select>
        </label>
      </div>
      <div className="brief-row">
        <label className="field">
          <span>Tone</span>
          <input
            value={fields.tone}
            maxLength={300}
            disabled={disabled}
            placeholder="curious, upbeat, a bit nerdy"
            onChange={(event) => {
              set({ tone: event.target.value });
            }}
          />
        </label>
        <label className="field">
          <span>Audience</span>
          <input
            value={fields.audience}
            maxLength={300}
            disabled={disabled}
            placeholder="tech fans who never coded"
            onChange={(event) => {
              set({ audience: event.target.value });
            }}
          />
        </label>
      </div>
      <label className="field">
        <span>Notes for the writer (optional)</span>
        <textarea
          value={fields.notes}
          rows={2}
          maxLength={4000}
          disabled={disabled}
          placeholder="Must mention the 1993 original; no swearing."
          onChange={(event) => {
            set({ notes: event.target.value });
          }}
        />
      </label>
      <div className="brief-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            act(false);
          }}
        >
          Save brief
        </button>
        <button type="submit" className="primary" disabled={disabled}>
          {props.hasScript ? 'Rewrite script…' : 'Write script'}
        </button>
        {props.busy && <span className="muted">The script is being written…</span>}
      </div>
      {message !== undefined && (
        <p
          className={message.error ? 'panel-error' : 'muted'}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
      {confirmRewrite && (
        <ConfirmDialog
          title="Rewrite the script?"
          confirmLabel="Rewrite"
          busy={false}
          onCancel={() => {
            setConfirmRewrite(false);
          }}
          onConfirm={() => {
            setConfirmRewrite(false);
            act(true);
          }}
        >
          <p>
            Claude researches the topic again and replaces research.md, beats.md and script.txt
            (your edits too). The current version stays in the project history.
          </p>
        </ConfirmDialog>
      )}
    </form>
  );
}
