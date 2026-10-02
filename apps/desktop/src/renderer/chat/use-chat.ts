/**
 * Chat state of the open project (PLAN.md#6.6): read once, then follow main's `chatChanged`
 * pushes; actions go to main (send/queue, remove from the queue, Stop, "Try now").
 */
import { useCallback, useEffect, useState } from 'react';
import type { ChatSendRequest, ChatState } from '../../shared/chat-contract.js';
import { errorMessage, rendererLog } from '../log.js';

const log = rendererLog('chat');

export interface ChatControls {
  readonly state: ChatState | undefined;
  /** Why the last send was refused (cleared by the next successful send). */
  readonly sendError: string | undefined;
  readonly send: (request: ChatSendRequest) => Promise<boolean>;
  readonly remove: (turnId: string) => void;
  readonly stop: () => void;
  readonly resume: () => void;
}

function report(action: string): (error: unknown) => void {
  return (error) => {
    log.error(`${action} failed: ${errorMessage(error)}`);
  };
}

export function useChat(): ChatControls {
  const [state, setState] = useState<ChatState | undefined>(undefined);
  const [sendError, setSendError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const unsubscribe = window.reelforge.onChatChanged((next) => {
      if (active) setState(next);
    });
    window.reelforge.getChatState().then((initial) => {
      if (active) setState((current) => current ?? initial);
    }, report('getChatState'));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const send = useCallback(async (request: ChatSendRequest): Promise<boolean> => {
    try {
      const result = await window.reelforge.sendChat(request);
      if (result.status === 'error') {
        setSendError(result.error.message);
        return false;
      }
      setSendError(undefined);
      return true;
    } catch (error) {
      report('sendChat')(error);
      setSendError(errorMessage(error));
      return false;
    }
  }, []);

  const remove = useCallback((turnId: string) => {
    window.reelforge.removeQueuedChat(turnId).catch(report('removeQueuedChat'));
  }, []);
  const stop = useCallback(() => {
    window.reelforge.stopChat().catch(report('stopChat'));
  }, []);
  const resume = useCallback(() => {
    window.reelforge.resumeChat().catch(report('resumeChat'));
  }, []);

  return { state, sendError, send, remove, stop, resume };
}
