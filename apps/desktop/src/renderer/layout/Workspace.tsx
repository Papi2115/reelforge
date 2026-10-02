/**
 * The open project's workspace (PLAN.md#6.3): wires the snapshot, the player (shared time, PLAN.md
 * #6.4) and the timeline (selection, edits, waveform; PLAN.md#6.5) into the panels of the shell.
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { JSX } from 'react';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { playbackAudioUrl } from '../preview/audio-source.js';
import { PreviewPanel } from '../preview/PreviewPanel.js';
import { usePlayer, usePlayerState } from '../preview/use-player.js';
import { useTimeline } from '../timeline/use-timeline.js';
import { AppShell } from './AppShell.js';
import { ChatPanel } from './ChatPanel.js';
import { PipelineSidebar } from './PipelineSidebar.js';
import { ShotsPanel } from './ShotsPanel.js';
import { TimelinePanel } from './TimelinePanel.js';
import { useProjectSnapshot } from './use-project-snapshot.js';

export interface WorkspaceProps {
  readonly project: ProjectSummary;
}

export function Workspace({ project }: WorkspaceProps): JSX.Element {
  const { snapshot, error, previewRevision, audioRevision, reload } = useProjectSnapshot(
    project.dir,
  );
  const files = snapshot?.files ?? [];
  const player = usePlayer(playbackAudioUrl(files, audioRevision));
  const { time, duration, playing, fps } = usePlayerState(player);
  const timeline = useTimeline(project.dir, snapshot, reload, audioRevision, duration);

  const selectShot = (shot: StoryboardShot): void => {
    timeline.selection.set([{ kind: 'shot', id: shot.id }]);
    player.seek(shot.t0);
  };

  return (
    <AppShell
      left={
        <div className="left-stack">
          {error !== undefined && (
            <p className="panel-error banner" role="alert">
              {error}
            </p>
          )}
          <PipelineSidebar files={snapshot?.files} />
          <ShotsPanel
            storyboard={snapshot?.storyboard}
            selectedId={timeline.selectedShotId}
            time={time}
            onSelect={selectShot}
          />
        </div>
      }
      center={
        <PreviewPanel
          source={{ kind: 'project', revision: previewRevision }}
          player={player}
          snapshots
        />
      }
      right={<ChatPanel selectedShotId={timeline.selectedShotId} />}
      bottom={
        <TimelinePanel
          model={timeline.model}
          duration={timeline.duration}
          time={time}
          playing={playing}
          fps={fps}
          selection={timeline.selection}
          editing={timeline.editing}
          waveform={timeline.waveform}
          onSeek={(t) => {
            player.seek(t);
          }}
          onScrub={(t) => {
            player.scrub(t);
          }}
        />
      }
    />
  );
}
