/**
 * IPC handlers of the project menu, the preview snapshots (PLAN.md#6.2, #6.4) and the project
 * settings dialog (project-settings-ipc.ts), merged into `registerIpc` by main.ts.
 */
import { copyPngToClipboard } from './clipboard.js';
import { saveFrameSnapshot } from './frame-snapshots.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import type { ProjectService } from './project-service.js';
import { projectSettingsHandlers, type ProjectSettingsHandlers } from './project-settings-ipc.js';

export type ProjectHandlers = Pick<
  InvokeHandlers,
  | 'projectNew'
  | 'projectOpen'
  | 'projectOpenRecent'
  | 'projectRecent'
  | 'projectCurrent'
  | 'projectClose'
  | 'projectHistory'
  | 'projectRevert'
  | 'projectSnapshot'
  | 'projectManifest'
  | 'projectRepairFile'
  | 'projectRestoreFailedOpen'
  | 'snapshotSave'
  | 'snapshotCopy'
> &
  ProjectSettingsHandlers;

/** `log`: the project scope; snapshots and settings log under their own child scopes. */
export function projectHandlers(projects: ProjectService, log: Logger): ProjectHandlers {
  const snapshotLog = log.child('snapshot');
  return {
    projectNew: (request) => projects.newProject(request),
    projectOpen: () => projects.openWithPicker(),
    projectOpenRecent: (request) => projects.openRecent(request.dir),
    projectRecent: () => projects.recent(),
    projectCurrent: () => Promise.resolve(projects.currentProject()),
    projectClose: () => Promise.resolve(projects.close()),
    projectHistory: (request) => projects.history(request.limit),
    projectRevert: (request) => projects.revert(request.hash),
    projectSnapshot: () => projects.snapshot(),
    projectManifest: () => projects.manifest(),
    projectRepairFile: (request) => projects.repairFile(request.file),
    projectRestoreFailedOpen: () => projects.restoreFailedOpen(),
    snapshotSave: (request) =>
      saveFrameSnapshot(projects.currentProject()?.dir, request, snapshotLog),
    snapshotCopy: (request) => copyPngToClipboard(request.png),
    ...projectSettingsHandlers(projects, log.child('settings')),
  };
}
