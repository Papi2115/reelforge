/**
 * "Add topics (one per line)" of a channel's queue (PLAN.md#13.9): a textarea, the hint on the
 * "Topic | minutes" syntax, the problems of each line in plain words, and Add. Films are English.
 */
import { useId, useState, type JSX } from 'react';
import { plural } from '../../shared/plural.js';
import { ADD_TOPICS_HINT, parseTopics } from './queue-view.js';
import { useLineCommand } from './use-line-command.js';

export function AddTopics({ channelId }: { readonly channelId: string }): JSX.Element {
  const [text, setText] = useState('');
  const command = useLineCommand();
  const hintId = useId();
  const parsed = parseTopics(text);
  const count = parsed.topics.length;
  const canAdd = count > 0 && parsed.errors.length === 0 && !command.busy;
  return (
    <section className="line-section line-add" aria-label="Add topics">
      <label className="line-add-label" htmlFor={`${hintId}-text`}>
        Add topics (one per line)
      </label>
      <textarea
        id={`${hintId}-text`}
        rows={2}
        value={text}
        aria-describedby={hintId}
        placeholder={'Why is the sky blue\nHow magnets work | 6'}
        onChange={(event) => {
          setText(event.target.value);
          command.clear();
        }}
      />
      {parsed.errors.length > 0 && (
        <ul className="line-errors" role="alert">
          {parsed.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      <div className="line-row line-add-foot">
        <p className="line-hint" id={hintId}>
          {ADD_TOPICS_HINT}
        </p>
        {command.note !== null && (
          <span className={command.note.error ? 'line-note error' : 'line-note'} role="status">
            {command.note.text}
          </span>
        )}
        <button
          type="button"
          className="primary"
          disabled={!canAdd}
          onClick={() => {
            void command
              .run('addQueueTopics', () =>
                window.reelforge.addQueueTopics(channelId, parsed.topics),
              )
              .then((added) => {
                if (added) setText('');
              });
          }}
        >
          {count > 1 ? `Add ${plural(count, 'topic')}` : 'Add topic'}
        </button>
      </div>
    </section>
  );
}
