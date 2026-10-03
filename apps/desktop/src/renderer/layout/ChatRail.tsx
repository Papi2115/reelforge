/**
 * The collapsed chat (PLAN.md#11.2): a slim rail with the "Show chat" button, whether Claude is
 * working, the queue and the turns that finished while the chat was hidden.
 */
import type { JSX } from 'react';
import { plural } from '../../shared/plural.js';
import { TOGGLE_CHAT_KEYS } from './app-keys.js';
import { ChatIcon } from './icons.js';

export interface ChatRailProps {
  readonly working: boolean;
  readonly queued: number;
  readonly unread: number;
  readonly paused: boolean;
  readonly onShow: () => void;
}

function railStatus({ working, queued, unread, paused }: ChatRailProps): string {
  const parts = [
    paused ? 'Claude is paused (usage limit)' : working ? 'Claude is working' : null,
    queued > 0 ? `${plural(queued, 'message')} queued` : null,
    unread > 0 ? plural(unread, 'new reply', 'new replies') : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? 'Chat with Claude' : parts.join(' · ');
}

export function ChatRail(props: ChatRailProps): JSX.Element {
  const status = railStatus(props);
  return (
    <div className="chat-rail">
      <button
        type="button"
        className="chat-rail-button"
        aria-label="Show chat"
        aria-expanded={false}
        title={`Show chat (${TOGGLE_CHAT_KEYS}) · ${status}`}
        onClick={props.onShow}
      >
        <ChatIcon />
        {props.unread > 0 && (
          <span className="chat-rail-unread" data-testid="chat-unread">
            {props.unread}
          </span>
        )}
      </button>
      <span
        className={`chat-rail-state${props.paused ? ' paused' : props.working ? ' working' : ''}`}
        role="status"
        title={status}
      >
        <span className="visually-hidden">{status}</span>
      </span>
      {props.queued > 0 && (
        <span className="chat-rail-queue mono" title={`${plural(props.queued, 'message')} queued`}>
          {props.queued}
        </span>
      )}
      <span className="chat-rail-label" aria-hidden="true">
        Claude
      </span>
    </div>
  );
}
