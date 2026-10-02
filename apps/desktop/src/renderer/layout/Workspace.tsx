/**
 * The open project's workspace (PLAN.md#6.3): wires the snapshot, the player (shared time, PLAN.md
 * #6.4) and the shot selection into the panels of the app shell.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useState, type JSX } from 'react';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { playbackAudioUrl } from '../preview/audio-source.js';
import { PreviewPanel } from '../preview/PreviewPanel.js';
import { usePlayer, usePlayerState } from '../preview/use-player.js';
import { AppShell } from './AppShell.js';
import { ChatPanel } from './ChatPanel.js';
import { PipelineSidebar } from './PipelineSidebar.js';
import { ShotsPanel } from './ShotsPanel.js';
import { TimelinePanel } from './TimelinePanel.js';
import { useProjectSnapshot } from './use-project-snapshot.js';

/** The cleaned voice-over, else the original one. */
const VOICEOVER_FILES = [/^audio\/vo\.clean\.wav$/i, /^audio\/vo\.original\.[^/]+$/i];

function voiceoverName(files: readonly string[]): string | undefined {
  for (const pattern of VOICEOVER_FILES) {
    const file = files.find((candidate) => pattern.test(candidate));
    if (file !== undefined) return file.slice('audio/'.length);
  }
  return undefined;
}

export interface WorkspaceProps {
  readonly project: ProjectSummary;
}

export function Workspace({ project }: WorkspaceProps): JSX.Element {
  const { snapshot, error, previewRevision, audioRevision } = useProjectSnapshot(project.dir);
  const files = snapshot?.files ?? [];
  const player = usePlayer(playbackAudioUrl(files, audioRevision));
  const { time, duration } = usePlayerState(player);
  const [selectedShotId, setSelectedShotId] = useState<string | undefined>(undefined);

  const storyboard = snapshot?.storyboard;
  const shots: readonly StoryboardShot[] = storyboard?.status === 'ok' ? storyboard.data.shots : [];
  const words = snapshot?.words.status === 'ok' ? snapshot.words.data.words : [];
  const cues = snapshot?.cues.status === 'ok' ? snapshot.cues.data : undefined;
  const voiceover = voiceoverName(files);

  const selectShot = (shot: StoryboardShot): void => {
    setSelectedShotId(shot.id);
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
            storyboard={storyboard}
            selectedId={selectedShotId}
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
      right={<ChatPanel selectedShotId={selectedShotId} />}
      bottom={
        <TimelinePanel
          duration={duration}
          time={time}
          shots={shots}
          words={words}
          cues={cues}
          voiceover={voiceover}
          selectedShotId={selectedShotId}
          onScrub={(t) => {
            player.scrub(t);
          }}
        />
      }
    />
  );
}
