/**
 * IPC payloads of the onboarding and the Help menu (PLAN.md#10.3): opening a fresh copy of the
 * bundled example project, and opening the logs folder or the licences file in the system's
 * file browser / viewer (no network). Merged into ipc-contract.ts.
 */
import { z } from 'zod';
import { projectOpenResultSchema, type ProjectOpenResult } from './project-contract.js';

/** What Help can open: the logs folder (also "Report a problem") or the bundled licences. */
export const HELP_TARGETS = ['logs', 'licenses'] as const;
export const helpTargetSchema = z.enum(HELP_TARGETS);
export type HelpTarget = z.infer<typeof helpTargetSchema>;

export const helpOpenResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('opened'), path: z.string() }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
export type HelpOpenResult = z.infer<typeof helpOpenResultSchema>;

export const ONBOARDING_IPC = {
  /** Copies the example into `Documents/ReelForge Projects/<unique name>` and opens it. */
  projectOpenExample: {
    name: 'project:open-example',
    request: z.null(),
    response: projectOpenResultSchema,
  },
  helpOpen: {
    name: 'help:open',
    request: z.strictObject({ target: helpTargetSchema }),
    response: helpOpenResultSchema,
  },
} as const;

export interface OnboardingApi {
  openExampleProject(): Promise<ProjectOpenResult>;
  openHelpTarget(target: HelpTarget): Promise<HelpOpenResult>;
}
