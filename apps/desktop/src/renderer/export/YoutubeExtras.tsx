/**
 * "YouTube texts" of the export dialog (PLAN.md#9.2 + #12.17, U11 of docs/ux/redesign-2.4.md): one
 * section with "Suggest with Claude" (the template when Claude cannot help, saying why), the title
 * ideas from `out/metadata.json` with a Copy button each, then the publish kit's paste-ready texts
 * (description, chapters, tags, credits; the description and tags carry the suggestion).
 */
import { useState, type JSX } from 'react';
import type { YoutubeMetaFile } from '@reelforge/shared';
import { errorMessage } from '../log.js';
import { PublishKit } from '../publish/PublishKit.js';
import { CopyButton } from './CopyButton.js';

export interface YoutubeExtrasProps {
  readonly meta: YoutubeMetaFile | null;
  readonly onMeta: (meta: YoutubeMetaFile) => void;
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
    <section className="youtube-extras" aria-labelledby="youtube-texts-title">
      <div className="youtube-head">
        <h3 className="section-title" id="youtube-texts-title">
          YouTube texts
        </h3>
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
      <div className="publish-file">
        <span className="publish-file-label">Title ideas</span>
        {meta === null ? (
          <p className="muted youtube-note">
            Title ideas appear after an export, or ask Claude now.
          </p>
        ) : (
          <ol className="youtube-titles" aria-label="Title options">
            {meta.titles.map((title, index) => (
              <li key={title}>
                <span>{title}</span>
                <CopyButton text={title} label={`title ${String(index + 1)}`} />
              </li>
            ))}
          </ol>
        )}
      </div>
      <PublishKit revision={meta?.generatedAt ?? ''} />
    </section>
  );
}
