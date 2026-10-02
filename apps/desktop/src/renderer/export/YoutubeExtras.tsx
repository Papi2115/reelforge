/**
 * YouTube extras of the export dialog (PLAN.md#9.2): the chapters that go into the description,
 * the suggested title options, description and tags from `out/metadata.json` with a Copy button
 * each, and "Suggest with Claude" (the template when Claude cannot help, saying why).
 */
import { useState, type JSX } from 'react';
import type { YoutubeMetaFile } from '@reelforge/shared';
import { errorMessage } from '../log.js';

export interface YoutubeExtrasProps {
  readonly meta: YoutubeMetaFile | null;
  readonly chapters: { readonly text: string | null; readonly problem: string | null };
  readonly onMeta: (meta: YoutubeMetaFile) => void;
}

function CopyButton({
  text,
  label,
}: {
  readonly text: string;
  readonly label: string;
}): JSX.Element {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="small-button"
      aria-label={`Copy ${label}`}
      onClick={() => {
        void window.reelforge.copyText(text).then(
          (result) => {
            setState(result.status === 'copied' ? 'copied' : 'failed');
          },
          () => {
            setState('failed');
          },
        );
      }}
    >
      {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Copy failed' : 'Copy'}
    </button>
  );
}

export function YoutubeExtras(props: YoutubeExtrasProps): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { meta } = props;

  const generate = (): void => {
    setBusy(true);
    setNote(null);
    window.reelforge.generateYoutubeMeta().then(
      (result) => {
        setBusy(false);
        if (result.status === 'ok') {
          props.onMeta(result.meta);
          setNote(result.fallback === null ? null : `Template used: ${result.fallback}`);
        } else {
          setNote(result.message);
        }
      },
      (error: unknown) => {
        setBusy(false);
        setNote(errorMessage(error));
      },
    );
  };

  return (
    <section className="youtube-extras" aria-label="YouTube">
      <div className="youtube-head">
        <h3 className="section-title">YouTube</h3>
        <button
          type="button"
          className="small-button"
          aria-disabled={busy}
          onClick={() => {
            if (!busy) generate();
          }}
        >
          {busy ? 'Asking Claude…' : 'Suggest with Claude'}
        </button>
        {meta !== null && (
          <span className="muted youtube-source">
            {meta.source === 'claude' ? 'by Claude' : 'template'}
          </span>
        )}
      </div>
      {note !== null && <p className="muted youtube-note">{note}</p>}
      <p className="muted youtube-chapters">
        {props.chapters.text === null
          ? `Chapters: ${props.chapters.problem ?? 'none'}`
          : `Chapters: ${String(props.chapters.text.trim().split('\n').length)} (in the description)`}
      </p>
      {meta === null ? (
        <p className="muted">Suggestions appear after an export, or ask Claude now.</p>
      ) : (
        <>
          <ol className="youtube-titles" aria-label="Title options">
            {meta.titles.map((title, index) => (
              <li key={title}>
                <span>{title}</span>
                <CopyButton text={title} label={`title ${String(index + 1)}`} />
              </li>
            ))}
          </ol>
          <div className="youtube-field">
            <pre className="youtube-description" aria-label="Description">
              {meta.description}
            </pre>
            <CopyButton text={meta.description} label="description" />
          </div>
          <div className="youtube-field">
            <p className="youtube-tags" aria-label="Tags">
              {meta.tags.join(', ')}
            </p>
            <CopyButton text={meta.tags.join(', ')} label="tags" />
          </div>
        </>
      )}
    </section>
  );
}
