/** IPC handlers of the hook lab (PLAN.md#12.16), merged into `registerIpc` by main.ts. */
import type { InvokeHandlers } from '../ipc-router.js';
import { HookLabService, type HookLabServiceOptions } from './hook-lab-service.js';

export type HookLabHandlers = Pick<
  InvokeHandlers,
  'hookLabState' | 'hookLabGenerate' | 'hookLabPick' | 'hookLabDiscard'
>;

export function hookLabHandlers(options: HookLabServiceOptions): HookLabHandlers {
  const service = new HookLabService(options);
  return {
    hookLabState: () => service.state(),
    hookLabGenerate: () => service.generate(),
    hookLabPick: (request) => service.pick(request),
    hookLabDiscard: (request) => service.discard(request.number),
  };
}
