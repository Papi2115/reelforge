/**
 * "Tags and timestamps" (PLAN.md#13.17): the 15 SEO tags by word count and the 5–8 chapter
 * timestamps of `publish/seo.json`, with Copy buttons and Regenerate. A pure component (state and
 * IPC live in the caller), reused by the export dialog's publish kit and the project overview.
 */
import type { JSX } from 'react';
import type { PublishSeoFile } from '@reelforge/shared';
import {
  seoActionLabel,
  seoChaptersNote,
  seoChaptersText,
  seoSourceNote,
  seoStaleNote,
  seoTagRows,
  seoTagsText,
} from './seo-view.js';

export interface PublishSeoViewProps {
  /** null: not written yet. */
  readonly seo: PublishSeoFile | null;
  /** Length of the film in seconds (0: unknown). */
  readonly durationS: number;
  readonly onCopyTags: (text: string) => void;
  readonly onCopyChapters: (text: string) => void;
  readonly onRegenerate: () => void;
  readonly busy: boolean;
  /** Outcome of the last action (copy, regenerate), or a problem reading the file. */
  readonly status: string | null;
}

export function PublishSeoView({
  seo,
  durationS,
  onCopyTags,
  onCopyChapters,
  onRegenerate,
  busy,
  status,
}: PublishSeoViewProps): JSX.Element {
  const stale = seo === null ? null : seoStaleNote(seo, durationS);
  const chapters = seo === null ? '' : seoChaptersText(seo, durationS);
  return (
    <section className="publish-seo" aria-label="Tags and timestamps">
      <div className="publish-file-head">
        <span className="publish-file-label">Tags and timestamps</span>
        <button type="button" className="small-button" aria-disabled={busy} onClick={onRegenerate}>
          {seoActionLabel(seo, busy)}
        </button>
      </div>
      {seo === null ? (
        <p className="muted publish-note">
          15 search tags (one, two and three words, for this video and the whole channel) and 5–8
          chapter timestamps.
        </p>
      ) : (
        <>
          <p className="muted publish-note">{seoSourceNote(seo)}</p>
          {stale !== null && (
            <p className="export-note qa-warning" role="alert">
              {stale}
            </p>
          )}
          <div className="publish-file-head">
            <span className="publish-file-label">Tags</span>
            <button
              type="button"
              className="small-button"
              aria-label="Copy tags"
              onClick={() => {
                onCopyTags(seoTagsText(seo));
              }}
            >
              Copy
            </button>
          </div>
          {seoTagRows(seo).map((row) => (
            <p key={row.group} className="publish-seo-tags">
              <span className="muted">{row.label}:</span> {row.tags.join(', ')}
            </p>
          ))}
          <div className="publish-file-head">
            <span className="publish-file-label">Timestamps</span>
            {seo.chapters.length > 0 && (
              <button
                type="button"
                className="small-button"
                aria-label="Copy timestamps"
                onClick={() => {
                  onCopyChapters(chapters);
                }}
              >
                Copy
              </button>
            )}
          </div>
          <p className="muted publish-note">{seoChaptersNote(seo)}</p>
          {chapters !== '' && (
            <pre className="publish-text mono publish-seo-chapters">{chapters}</pre>
          )}
        </>
      )}
      {status !== null && (
        <p className="muted publish-note" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
