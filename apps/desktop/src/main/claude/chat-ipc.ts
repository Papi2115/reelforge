/** IPC handlers of the chat panel (PLAN.md#6.6), merged into `registerIpc` by main.ts. */
import type { InvokeHandlers } from '../ipc-router.js';
import type { ClaudeService } from './claude-service.js';

export type ChatHandlers = Pick<
  InvokeHandlers,
  'chatState' | 'chatSend' | 'chatRemove' | 'chatStop' | 'chatResume'
>;

export function chatHandlers(service: ClaudeService): ChatHandlers {
  return {
    chatState: () => Promise.resolve(service.state()),
    chatSend: (request) => service.send(request),
    chatRemove: (request) => Promise.resolve(service.remove(request.turnId)),
    chatStop: () => service.stop(),
    chatResume: () => {
      service.resume();
      return Promise.resolve(null);
    },
  };
}
