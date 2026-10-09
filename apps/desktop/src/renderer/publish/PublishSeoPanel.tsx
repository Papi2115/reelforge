/**
 * The export dialog's "Tags and timestamps" (PLAN.md#13.17): reads `publish/seo.json` of the open
 * project, (re)writes it through Claude (or the fallback) and copies the tags or timestamps.
 * `onChanged` lets the publish kit re-read its texts (tags.txt and chapters.txt use the file).
 */
import { useCallback, useEffect, useState, type JSX } from 'react';
import type { PublishSeoState } from '../../shared/publish-contract.js';
import { errorMessage } from '../log.js';
import { PublishSeoView } from './PublishSeoView.js';
import { seoGenerateNote } from './seo-view.js';

export interface PublishSeoPanelProps {
  /** Changes when the project's texts may have changed (the file is read again). */
  readonly revision: string;
  readonly onChanged: () => void;
}

export function PublishSeoPanel({ revision, onChanged }: PublishSeoPanelProps): JSX.Element {
  const [state, setState] = useState<PublishSeoState | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    window.reelforge.getPublishSeo().then(setState, (error: unknown) => {
      setState({ status: 'error', message: errorMessage(error) });
    });
  }, []);

  useEffect(() => {
    load();
  }, [load, revision]);

  const regenerate = (): void => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    window.reelforge.generatePublishSeo().then(
      (result) => {
        setBusy(false);
        setNote(seoGenerateNote(result));
        if (result.status === 'ok') {
          setState(result.state);
          onChanged();
        }
      },
      (error: unknown) => {
        setBusy(false);
        setNote(`Not written: ${errorMessage(error)}`);
      },
    );
  };
  const copy = (what: string) => (text: string) => {
    window.reelforge.copyText(text).then(
      (result) => {
        setNote(result.status === 'copied' ? `${what} copied.` : `Copy failed.`);
      },
      () => {
        setNote('Copy failed.');
      },
    );
  };

  if (state?.status === 'error') return <p className="muted publish-note">{state.message}</p>;
  const ok = state?.status === 'ok' ? state : null;
  return (
    <PublishSeoView
      seo={ok?.seo ?? null}
      durationS={ok?.durationS ?? 0}
      onCopyTags={copy('Tags')}
      onCopyChapters={copy('Timestamps')}
      onRegenerate={regenerate}
      busy={busy || ok?.generating === true}
      status={note ?? ok?.problem ?? null}
    />
  );
}
