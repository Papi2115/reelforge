/**
 * IPC handlers of the "Project settings" dialog (project.json options: look mode, ambient
 * variation), merged into the project handlers (project-ipc.ts). The list of looks comes from
 * the kit's look registry, so a newly available look shows up without a UI change.
 */
import { listLooks, type Look } from '@reelforge/kit';
import type { LookSummary } from '../shared/project-settings-contract.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import type { ProjectService } from './project-service.js';
import { PROJECT_SETTINGS_STEP, ProjectSettingsService } from './project-settings-service.js';

export type ProjectSettingsHandlers = Pick<
  InvokeHandlers,
  'projectSettingsGet' | 'projectSettingsUpdate'
>;

/** Available looks (voxel first) as the dialog lists them. */
export function lookSummaries(looks: readonly Look[] = listLooks()): LookSummary[] {
  return looks.map((look) => ({ id: look.id, label: look.label, description: look.description }));
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
    looks: () => lookSummaries(),
    log,
  });
  return {
    projectSettingsGet: () => service.get(),
    projectSettingsUpdate: (patch) => service.update(patch),
  };
}
