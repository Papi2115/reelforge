/**
 * UI state of the whisper model manager (PLAN.md#6.7): the list from main plus the pushed
 * download progress, reduced into one row view per model. Pure; the component feeds it events.
 */
import type { SettingsWhisperModel } from '@reelforge/shared';
import type { WhisperModelsState, WhisperProgress } from '../../shared/settings-contract.js';

export interface WhisperModelsView {
  readonly list: WhisperModelsState | undefined;
  /** Latest progress per model (kept after the end to show failures). */
  readonly progress: Readonly<Partial<Record<SettingsWhisperModel, WhisperProgress>>>;
  /** Last action error (download refused, delete failed). */
  readonly error: string | undefined;
}

export type WhisperModelsEvent =
  | { readonly type: 'loaded'; readonly list: WhisperModelsState }
  | { readonly type: 'progress'; readonly progress: WhisperProgress }
  | { readonly type: 'error'; readonly message: string };

export const EMPTY_WHISPER_VIEW: WhisperModelsView = {
  list: undefined,
  progress: {},
  error: undefined,
};

export function reduceWhisperModels(
  view: WhisperModelsView,
  event: WhisperModelsEvent,
): WhisperModelsView {
  switch (event.type) {
    case 'loaded':
      return { ...view, list: event.list };
    case 'error':
      return { ...view, error: event.message };
    case 'progress': {
      const { progress } = event;
      const finished = progress.phase !== 'downloading';
      const list =
        view.list === undefined
          ? undefined
          : {
              ...view.list,
              downloading: finished ? null : progress.model,
              vadInstalled: view.list.vadInstalled || progress.phase === 'done',
              models: view.list.models.map((model) =>
                model.id === progress.model && progress.phase === 'done'
                  ? { ...model, installed: true }
                  : model,
              ),
            };
      return {
        list,
        progress: { ...view.progress, [progress.model]: progress },
        error: progress.phase === 'failed' ? progress.message : view.error,
      };
    }
  }
}

export type WhisperRowStatus = 'installed' | 'missing' | 'downloading' | 'failed' | 'cancelled';

export interface WhisperRowView {
  readonly id: SettingsWhisperModel;
  readonly sizeLabel: string;
  readonly status: WhisperRowStatus;
  readonly statusLabel: string;
  /** 0..100, or null when the size is unknown / not downloading. */
  readonly percent: number | null;
  readonly canDownload: boolean;
  readonly canCancel: boolean;
  readonly canDelete: boolean;
}

/** `574000000` -> `574 MB`, `1530000000` -> `1.5 GB`. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${String(Math.round(bytes / 1e6))} MB`;
  return `${String(Math.round(bytes / 1e3))} kB`;
}

export function whisperRows(view: WhisperModelsView): WhisperRowView[] {
  const list = view.list;
  if (list === undefined) return [];
  const busy = list.downloading !== null;
  return list.models.map((model) => {
    const progress = view.progress[model.id];
    const downloading = list.downloading === model.id;
    let status: WhisperRowStatus = model.installed ? 'installed' : 'missing';
    if (downloading) status = 'downloading';
    else if (!model.installed && progress?.phase === 'failed') status = 'failed';
    else if (!model.installed && progress?.phase === 'cancelled') status = 'cancelled';
    const total = progress?.totalBytes ?? null;
    const percent =
      downloading && progress !== undefined && total !== null && total > 0
        ? Math.min(100, Math.floor((progress.receivedBytes / total) * 100))
        : null;
    // The voice-activity model is fetched first, under the same row.
    const assetNote = progress !== undefined && progress.asset !== model.id ? ' (VAD model)' : '';
    const labels: Readonly<Record<WhisperRowStatus, string>> = {
      installed: 'Installed',
      missing: 'Not downloaded',
      downloading:
        percent === null
          ? `Downloading…${assetNote}`
          : `Downloading ${String(percent)} %${assetNote}`,
      failed: 'Download failed',
      cancelled: 'Cancelled',
    };
    return {
      id: model.id,
      sizeLabel: formatBytes(model.approxBytes),
      status,
      statusLabel: labels[status],
      percent,
      canDownload: !busy && !model.installed,
      canCancel: downloading,
      canDelete: model.installed && !downloading,
    };
  });
}
