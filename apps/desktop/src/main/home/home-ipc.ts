/**
 * IPC handlers of the Home screen, the project overview and the Shorts area (PLAN.md#13.16,
 * #13.18), merged into `registerIpc` by main-ipc.ts.
 */
import type { InvokeHandlers } from '../ipc-router.js';
import type { OverviewService } from './overview-service.js';
import type { ProjectLibrary } from './project-library.js';
import type { ShortsService } from './shorts-service.js';

export type HomeHandlers = Pick<
  InvokeHandlers,
  | 'homeProjects'
  | 'homeOpen'
  | 'homeShowFolder'
  | 'homeRename'
  | 'homeOverview'
  | 'homeThumbnailUpload'
  | 'homeThumbnailRemove'
  | 'homeShowExport'
  | 'homeShortsCreate'
  | 'homeShortCaptions'
>;

export interface HomeServices {
  readonly library: ProjectLibrary;
  readonly overview: OverviewService;
  readonly shorts: ShortsService;
}

export function homeHandlers({ library, overview, shorts }: HomeServices): HomeHandlers {
  return {
    homeProjects: () => library.list(),
    homeOpen: (request) => library.open(request.dir),
    homeShowFolder: (request) => library.showFolder(request.dir),
    homeRename: (request) => library.rename(request.dir, request.title),
    homeOverview: (request) => overview.overview(request.dir),
    homeThumbnailUpload: (request) => overview.uploadThumbnail(request.dir),
    homeThumbnailRemove: (request) => overview.removeThumbnail(request.dir),
    homeShowExport: (request) => overview.showExport(request.dir),
    homeShortsCreate: (request) => shorts.create(request),
    homeShortCaptions: (request) => shorts.setCaptions(request.dir, request.captions),
  };
}
