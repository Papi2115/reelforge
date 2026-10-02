/**
 * IPC handlers of the onboarding and the Help menu (PLAN.md#10.3), merged into `registerIpc` by
 * main.ts: the example project and opening the logs folder / licences file with the system shell.
 */
import { existsSync } from 'node:fs';
import type { HelpOpenResult, HelpTarget } from '../shared/onboarding-contract.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import type { ProjectService } from './project-service.js';

export type OnboardingHandlers = Pick<InvokeHandlers, 'projectOpenExample' | 'helpOpen'>;

export interface OnboardingHandlerOptions {
  readonly projects: ProjectService;
  /** Folder of main.log. */
  readonly logsDir: string;
  /** Bundled copy of docs/licenses.md. */
  readonly licensesFile: string;
  /** `shell.openPath`: resolves to an error message, or '' on success. */
  readonly openPath: (target: string) => Promise<string>;
  readonly log: Logger;
}

export async function openHelpTarget(
  target: HelpTarget,
  options: Pick<OnboardingHandlerOptions, 'logsDir' | 'licensesFile' | 'openPath' | 'log'>,
): Promise<HelpOpenResult> {
  const file = target === 'logs' ? options.logsDir : options.licensesFile;
  if (!existsSync(file)) return { status: 'error', message: `${file} does not exist` };
  const problem = await options.openPath(file);
  if (problem !== '') {
    options.log.warn(`cannot open ${file}: ${problem}`);
    return { status: 'error', message: problem };
  }
  return { status: 'opened', path: file };
}

export function onboardingHandlers(options: OnboardingHandlerOptions): OnboardingHandlers {
  return {
    projectOpenExample: () => options.projects.openExample(),
    helpOpen: (request) => openHelpTarget(request.target, options),
  };
}
