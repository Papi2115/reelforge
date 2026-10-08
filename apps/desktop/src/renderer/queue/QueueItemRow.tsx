/**
 * One film of a channel's queue in the Production line dialog (PLAN.md#13.9): its number, topic,
 * length, status chip, one sentence (what it does now, what waits for you, why it failed), a thin
 * bar of the steps done, its buttons (the next action first), Move up / Move down and Remove
 * (asks first; the project folder stays).
 */
import { useState, type JSX, type Ref } from 'react';
import type {
  QueueFolder,
  QueueItemRef,
  QueueItemView,
  QueueOpenPanel,
} from '../../shared/queue-contract.js';
import {
  itemActions,
  itemSentence,
  STATUS_TONES,
  STATUS_WORDS,
  type ItemActionId,
} from './queue-view.js';
import { useLineCommand } from './use-line-command.js';

export interface QueueItemRowProps {
  readonly channelId: string;
  readonly item: QueueItemView;
  readonly index: number;
  readonly count: number;
  readonly voiceReady: boolean;
  readonly viewed: boolean;
  readonly focused: boolean;
  readonly rowRef?: Ref<HTMLLIElement>;
  /** Opens the film's project at a panel; resolves with a problem in plain words, if any. */
  readonly onOpen: (ref: QueueItemRef, panel: QueueOpenPanel) => Promise<string | undefined>;
  readonly onViewed: (itemId: string) => void;
}

const OPEN_PANELS: Partial<Record<ItemActionId, QueueOpenPanel>> = {
  'open-script': 'script',
  'review-photos': 'assets',
  'add-voice': 'voiceover',
  'open-project': 'project',
};

const FOLDERS: Partial<Record<ItemActionId, QueueFolder>> = {
  'open-video': 'video',
  'open-publish': 'publish',
};

function minutes(value: number): string {
  return `${String(Math.round(value * 10) / 10)} min`;
}

export function QueueItemRow(props: QueueItemRowProps): JSX.Element {
  const { channelId, item, index, count } = props;
  const ref: QueueItemRef = { channelId, itemId: item.id };
  const command = useLineCommand();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const api = window.reelforge;

  const act = (id: ItemActionId): void => {
    const panel = OPEN_PANELS[id];
    if (panel !== undefined) {
      if (id === 'open-script') props.onViewed(item.id);
      void command.run(id, async () => {
        const problem = await props.onOpen(ref, panel);
        return problem === undefined
          ? { status: 'ok', message: null }
          : { status: 'error', message: problem };
      });
      return;
    }
    const folder = FOLDERS[id];
    if (folder !== undefined) {
      void command.run(id, () => api.openQueueFolder(ref, folder));
      return;
    }
    switch (id) {
      case 'approve':
        void command.run(id, () => api.approveQueueScript(ref));
        return;
      case 'generate-voice':
        void command.run(id, () => api.wakeLine());
        return;
      case 'retry':
        void command.run(id, () => api.retryQueueItem(ref));
        return;
      case 'mark-checked':
        void command.run(id, () => api.markQueueReviewed(ref));
        return;
      case 'hold':
        void command.run(id, () => api.holdQueueItem(ref));
        return;
      case 'resume':
        void command.run(id, () => api.resumeQueueItem(ref));
        return;
      default:
        return;
    }
  };

  const tone = STATUS_TONES[item.status];
  const done = Math.round((100 * item.stepsDone) / item.stepsTotal);
  return (
    <li
      ref={props.rowRef}
      className={`line-item${props.focused ? ' focused' : ''}`}
      aria-label={item.topic}
      aria-current={props.focused ? 'true' : undefined}
    >
      <span className="line-item-number" aria-hidden="true">
        {String(index + 1)}
      </span>
      <div className="line-item-main">
        <div className="line-item-head">
          <span className="line-item-topic" title={item.topic}>
            {item.topic}
          </span>
          <span className="line-item-length">{minutes(item.targetMinutes)}</span>
          <span className={`line-chip tone-${tone}`}>{STATUS_WORDS[item.status]}</span>
        </div>
        <p className="line-item-sentence" title={item.message ?? undefined}>
          {itemSentence(item, props.voiceReady)}
        </p>
        <div
          className="line-item-bar"
          role="progressbar"
          aria-label={`${item.topic}: steps done`}
          aria-valuemin={0}
          aria-valuemax={item.stepsTotal}
          aria-valuenow={item.stepsDone}
        >
          <span style={{ width: `${String(done)}%` }} />
        </div>
        {item.status === 'done' && item.warnings.length > 0 && (
          <ul className="line-item-warnings" aria-label="Warnings">
            {item.warnings.slice(0, 3).map((warning) => (
              <li key={warning}>{warning.startsWith('⚠') ? warning : `⚠ ${warning}`}</li>
            ))}
          </ul>
        )}
        <div className="line-row line-item-actions">
          {itemActions(item, props.voiceReady, props.viewed).map((action) => (
            <button
              key={action.id}
              type="button"
              className={action.primary === true ? 'primary' : undefined}
              disabled={action.disabled === true || command.busy}
              title={action.title}
              onClick={() => {
                act(action.id);
              }}
            >
              {action.label}
            </button>
          ))}
          {command.note !== null && (
            <span className={command.note.error ? 'line-note error' : 'line-note'} role="status">
              {command.note.text}
            </span>
          )}
        </div>
      </div>
      <div className="line-item-side">
        <button
          type="button"
          className="icon-only"
          aria-label="Move up"
          title="Move up"
          disabled={index === 0 || command.busy}
          onClick={() => {
            void command.run('moveUp', () => api.moveQueueItem(ref, index - 1));
          }}
        >
          ↑
        </button>
        <button
          type="button"
          className="icon-only"
          aria-label="Move down"
          title="Move down"
          disabled={index === count - 1 || command.busy}
          onClick={() => {
            void command.run('moveDown', () => api.moveQueueItem(ref, index + 1));
          }}
        >
          ↓
        </button>
        {confirmRemove ? (
          <span className="line-confirm" role="group" aria-label="Remove this film?">
            <button
              type="button"
              className="danger"
              title="Takes it out of the queue; its project folder stays"
              onClick={() => {
                void command.run('remove', () => api.removeQueueItem(ref));
              }}
            >
              Remove it
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmRemove(false);
              }}
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            title="Take it out of the queue (its project folder stays)"
            onClick={() => {
              setConfirmRemove(true);
            }}
          >
            Remove
          </button>
        )}
      </div>
    </li>
  );
}
