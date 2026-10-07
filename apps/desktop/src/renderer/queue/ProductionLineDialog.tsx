/**
 * The "Production line" dialog (PLAN.md#13.9, docs/ui-copy.md): channel tabs (the channels of
 * Settings → Channels, in their order, each with a short summary), the line's controls (the same
 * line for every channel), the channel's own options (approve scripts automatically, pause the
 * channel, the default length), "Add topics" and the channel's queue. Opened from the header
 * (Ctrl+Shift+L), from a "Needs you" item or a system notification at one film. Escape closes it.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type {
  ChannelQueueView,
  QueueItemRef,
  QueueOpenPanel,
} from '../../shared/queue-contract.js';
import type { ChannelList } from '../channels/channel-view.js';
import { ChannelDot } from '../channels/ChannelBadge.js';
import { AddTopics } from './AddTopics.js';
import { ChannelOptions } from './ChannelOptions.js';
import { LineControls } from './LineControls.js';
import { QueueItemRow } from './QueueItemRow.js';
import { channelSummary } from './queue-view.js';
import type { ProductionLineController } from './use-production-line.js';

export interface ProductionLineDialogProps {
  readonly controller: ProductionLineController;
  readonly channels: ChannelList | undefined;
  /** Opens a film's project at a panel (the dialog closes); a problem in plain words, if any. */
  readonly onOpenFilm: (ref: QueueItemRef, panel: QueueOpenPanel) => Promise<string | undefined>;
}

function initialChannel(
  queues: readonly ChannelQueueView[],
  focus: QueueItemRef | null,
): string | undefined {
  if (focus !== null) return focus.channelId;
  const waiting = queues.find((queue) =>
    queue.items.some((item) => item.status === 'needs-approval' || item.status === 'needs-voice'),
  );
  return (waiting ?? queues[0])?.channelId;
}

export function ProductionLineDialog(props: ProductionLineDialogProps): JSX.Element {
  const { controller } = props;
  const state = controller.state;
  const focus = controller.dialog.focus;
  const queues = state?.channels ?? [];
  const [selected, setSelected] = useState<string | undefined>(() => initialChannel(queues, focus));
  const focusedRow = useRef<HTMLLIElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { close } = controller;

  useEffect(() => {
    if (focus !== null) setSelected(focus.channelId);
  }, [focus]);
  useEffect(() => {
    if (selected === undefined && queues.length > 0) setSelected(initialChannel(queues, focus));
  }, [selected, queues, focus]);
  useEffect(() => {
    if (focusedRow.current !== null) focusedRow.current.scrollIntoView({ block: 'nearest' });
    else closeRef.current?.focus();
  }, [focus, state === undefined]);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  const nameOf = (channelId: string): string =>
    props.channels?.channels.find((channel) => channel.id === channelId)?.name ?? channelId;
  const current = queues.find((queue) => queue.channelId === selected) ?? queues[0];

  return (
    <div className="modal-backdrop">
      <div
        className="settings-dialog production-line-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Production line"
      >
        <header className="settings-header">
          <h2 className="modal-title">Production line</h2>
          <button ref={closeRef} type="button" className="small-button" onClick={close}>
            Close
          </button>
        </header>
        {state === undefined ? (
          <p className="muted line-loading">Loading…</p>
        ) : (
          <div className="settings-body">
            <div className="settings-tabs line-tabs" role="tablist" aria-label="Channels">
              {queues.map((queue) => {
                const channel = props.channels?.channels.find(
                  (item) => item.id === queue.channelId,
                );
                return (
                  <button
                    key={queue.channelId}
                    type="button"
                    role="tab"
                    aria-selected={queue.channelId === current?.channelId}
                    className="settings-tab line-tab"
                    onClick={() => {
                      setSelected(queue.channelId);
                    }}
                  >
                    <span className="line-tab-name">
                      {channel !== undefined && <ChannelDot channel={channel} />}
                      {nameOf(queue.channelId)}
                    </span>
                    <span className="line-tab-summary">{channelSummary(queue)}</span>
                  </button>
                );
              })}
            </div>
            <div className="settings-panel line-panel" role="tabpanel">
              <LineControls state={state} nameOf={nameOf} />
              {current === undefined ? (
                <p className="muted">No channels yet: add one in Settings → Channels.</p>
              ) : (
                <>
                  <ChannelOptions key={current.channelId} queue={current} />
                  <AddTopics key={`add-${current.channelId}`} channelId={current.channelId} />
                  <section className="line-section line-queue" aria-label="Queue">
                    {current.error !== null && (
                      <p className="line-note error" role="alert">
                        The queue cannot be read: {current.error}
                      </p>
                    )}
                    {current.items.length === 0 ? (
                      <p className="muted line-empty">
                        No films in this channel yet. Add topics above, then press Start.
                      </p>
                    ) : (
                      <ol className="line-items" aria-label="Films in the queue">
                        {current.items.map((item, index) => {
                          const focused =
                            focus?.channelId === current.channelId && focus.itemId === item.id;
                          return (
                            <QueueItemRow
                              key={item.id}
                              channelId={current.channelId}
                              item={item}
                              index={index}
                              count={current.items.length}
                              voiceReady={current.voiceReady}
                              viewed={controller.viewed.has(item.id)}
                              focused={focused}
                              {...(focused ? { rowRef: focusedRow } : {})}
                              onOpen={props.onOpenFilm}
                              onViewed={controller.markViewed}
                            />
                          );
                        })}
                      </ol>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
