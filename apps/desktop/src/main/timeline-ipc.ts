/**
 * IPC handlers of the timeline editor (PLAN.md#6.5): edits of storyboard.json / cues.json
 * (committed as `manual` steps) and waveform peaks of the playing audio.
 */
import { locateFfmpeg } from '@reelforge/pipeline';
import type { ChildProcess } from 'node:child_process';
import type { InvokeHandlers } from './ipc-router.js';
import type { Logger } from './logger.js';
import type { ProjectService } from './project-service.js';
import { TimelineEditService } from './timeline-edit-service.js';
import { WaveformService } from './waveform-peaks.js';

/** The edit service of the open project (also used by the Sound panel's cues.json writes). */
export function createTimelineEdits(projects: ProjectService, log: Logger): TimelineEditService {
  return new TimelineEditService({
    projectDir: () => projects.currentProject()?.dir,
    commit: async (message, paths) => {
      const result = await projects.autocommit(message, { kind: 'manual', paths });
      if (!result.ok) log.warn(`timeline edit not committed: ${result.error.message}`);
      return result.ok && result.value.status === 'committed';
    },
    log: log.child('edit'),
  });
}

export interface TimelineHandlerOptions {
  readonly projects: ProjectService;
  readonly edits: TimelineEditService;
  readonly trackChild: (child: ChildProcess) => void;
  readonly log: Logger;
}

export function timelineHandlers(
  options: TimelineHandlerOptions,
): Pick<InvokeHandlers, 'timelineEdit' | 'timelineWaveform'> {
  const { projects, log } = options;
  const projectDir = (): string | undefined => projects.currentProject()?.dir;
  const { edits } = options;
  const waveforms = new WaveformService({
    projectDir,
    ffmpeg: () => {
      const located = locateFfmpeg();
      return located.ok ? { path: located.value.ffmpegPath } : { error: located.error.message };
    },
    track: options.trackChild,
    log: log.child('waveform'),
  });
  return {
    timelineEdit: (request) => edits.edit(request),
    timelineWaveform: (request) => waveforms.peaks(request.file),
  };
}
