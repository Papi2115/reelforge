/**
 * IPC handlers of the project menu and the preview snapshots (PLAN.md#6.2, #6.4), merged into
 * `registerIpc` by main.ts.
 */
import { copyPngToClipboard } from './clipboard.js';
import { saveFrameSnapshot } from './frame-snapshots.js';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import type { ProjectService } from './project-service.js';

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
  | 'snapshotSave'
  | 'snapshotCopy'
>;

export function projectHandlers(projects: ProjectService, log: Logger): ProjectHandlers {
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
    snapshotSave: (request) => saveFrameSnapshot(projects.currentProject()?.dir, request, log),
    snapshotCopy: (request) => copyPngToClipboard(request.png),
  };
}
