/**
 * A channel's own options of the production line (PLAN.md#13.9): approve scripts automatically
 * (off by default: you approve every script), pause this channel (its films are skipped), and the
 * length of films whose topic line names none. Saved by main right away.
 */
import { useState, type JSX } from 'react';
import {
  MAX_TOPIC_MINUTES,
  type ChannelQueueView,
  type QueueOptionsPatchView,
} from '../../shared/queue-contract.js';
import { useLineCommand } from './use-line-command.js';

export function ChannelOptions({ queue }: { readonly queue: ChannelQueueView }): JSX.Element {
  const command = useLineCommand();
  const [length, setLength] = useState(String(queue.defaultTargetMinutes));
  const save = (patch: QueueOptionsPatchView): void => {
    void command.run('setQueueOptions', () =>
      window.reelforge.setQueueOptions(queue.channelId, patch),
    );
  };
  const saveLength = (): void => {
    const minutes = Number(length.replace(',', '.'));
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_TOPIC_MINUTES) {
      setLength(String(queue.defaultTargetMinutes));
      return;
    }
    if (minutes !== queue.defaultTargetMinutes) save({ defaultTargetMinutes: minutes });
  };
  return (
    <section className="line-section line-options" aria-label="Channel options">
      <div className="line-row">
        <label
          className="line-check"
          title="Skips your approval: the line builds every script as Claude wrote it"
        >
          <input
            type="checkbox"
            checked={queue.autoApproveScript}
            onChange={(event) => {
              save({ autoApproveScript: event.target.checked });
            }}
          />
          <span>Approve scripts automatically</span>
        </label>
        <label className="line-check" title="The line skips this channel's films until you resume">
          <input
            type="checkbox"
            checked={queue.paused}
            onChange={(event) => {
              save({ paused: event.target.checked });
            }}
          />
          <span>Pause this channel</span>
        </label>
        <label className="line-field">
          <span>Default length</span>
          <input
            type="number"
            min={0.5}
            max={MAX_TOPIC_MINUTES}
            step={0.5}
            value={length}
            onChange={(event) => {
              setLength(event.target.value);
            }}
            onBlur={saveLength}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveLength();
            }}
          />
          <span className="muted">min</span>
        </label>
        <span
          className="line-voice muted"
          title={
            queue.voiceReady
              ? 'The channel has an ElevenLabs voice and key: the line generates every voiceover'
              : 'Add an ElevenLabs voice and key in Settings → Channels to generate the voiceovers'
          }
        >
          {queue.voiceReady ? 'Voice: ElevenLabs ✓' : 'Voice: you record it'}
        </span>
      </div>
      {command.note?.error === true && (
        <p className="line-note error" role="alert">
          {command.note.text}
        </p>
      )}
    </section>
  );
}
