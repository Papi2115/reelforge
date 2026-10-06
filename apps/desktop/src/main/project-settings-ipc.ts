/**
 * IPC handlers of the "Project settings" dialog (project.json options: look mode, ambient
 * variation, …), merged into the project handlers (project-ipc.ts). The looks come from the kit's
 * look registry for the project's style (`styleLookSummaries`, ADR-029: a world's style offers
 * only its own looks), so a newly available look shows up without a UI change.
 */
import { isWorldStyle } from '@reelforge/kit';
import { styleLooks, styleLookSummaries } from '@reelforge/stages';
import type { LookSummary, ProjectStyle } from '../shared/project-settings-contract.js';
import { describeStyle } from '../shared/style-choices.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import type { ProjectService } from './project-service.js';
import { PROJECT_SETTINGS_STEP, ProjectSettingsService } from './project-settings-service.js';

export type ProjectSettingsHandlers = Pick<
  InvokeHandlers,
  'projectSettingsGet' | 'projectSettingsUpdate'
>;

/**
 * The looks a project of `style` offers, as the dialog lists them (voxel first; a world: its
 * A/B/C looks). An experimental world's looks count only with Settings → Experimental worlds,
 * exactly as in the stages (`styleLookSummaries` alone leaves them out).
 */
export function lookSummaries(style?: string, experimentalWorlds = false): LookSummary[] {
  if (!experimentalWorlds || !isWorldStyle(style)) return styleLookSummaries(style);
  return styleLooks(style, { experimental: true }).map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}

/** The project's style as the dialog shows it; an unknown id as a plain built-in-like style. */
export function projectStyle(style: string, experimentalWorlds: boolean): ProjectStyle {
  const choice = describeStyle(style);
  if (choice === undefined) {
    return {
      id: style,
      label: style,
      description: '',
      world: false,
      preview: false,
      enabled: true,
    };
  }
  return { ...choice, enabled: !choice.preview || experimentalWorlds };
}

export function projectSettingsHandlers(
  projects: ProjectService,
  log: Logger,
): ProjectSettingsHandlers {
  const service = new ProjectSettingsService({
    projectDir: () => projects.currentProject()?.dir,
    commit: async (message) => {
      const result = await projects.autocommit(message, {
        kind: 'manual',
        step: PROJECT_SETTINGS_STEP,
      });
      if (!result.ok) log.warn(`project settings not committed: ${result.error.message}`);
      return result.ok && result.value.status === 'committed';
    },
    looks: (style) => lookSummaries(style, projects.experimentalWorlds()),
    style: (style) => projectStyle(style, projects.experimentalWorlds()),
    log,
  });
  return {
    projectSettingsGet: () => service.get(),
    projectSettingsUpdate: (patch) => service.update(patch),
  };
}
