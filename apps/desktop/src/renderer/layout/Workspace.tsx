/**
 * The open project's workspace (PLAN.md#6.3): wires the snapshot, the player (shared time, PLAN.md
 * #6.4) and the timeline (selection, edits, waveform; PLAN.md#6.5) into the panels of the shell.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useEffect, useRef, useState, type JSX } from 'react';
import type { ChatSelection } from '../../shared/chat-contract.js';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { selectionText, toSelection } from '../chat/step-view.js';
import { playbackAudioUrl } from '../preview/audio-source.js';
import { PreviewPanel } from '../preview/PreviewPanel.js';
import { usePlayer, usePlayerState } from '../preview/use-player.js';
import type { OpenTarget } from '../stages/pipeline-view.js';
import { ScriptPanel, type ScriptTab } from '../stages/ScriptPanel.js';
import { ScenesPanel } from '../stages/ScenesPanel.js';
import {
  buildProgress,
  fixPrompt,
  missingProps,
  missingPropsBanner,
  shotBadges,
} from '../stages/scenes-view.js';
import { reportsKey, useStageReports } from '../stages/use-stage-reports.js';
import { useStages } from '../stages/use-stages.js';
import { VoiceoverPanel } from '../stages/VoiceoverPanel.js';
import { WordsPanel } from '../stages/WordsPanel.js';
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

/** A document shown over the preview (Open of a stage, the brief). */
type CenterDocument =
  | { readonly kind: 'script'; readonly tab: ScriptTab }
  | { readonly kind: 'words' }
  | { readonly kind: 'voiceover' }
  | { readonly kind: 'scenes' };

/** Brings the Shots panel into view (Open of the Storyboard stage). */
function focusShots(): void {
  const panel = document.querySelector<HTMLElement>('[aria-label="Shots"]');
  const target = panel?.querySelector<HTMLElement>('button') ?? panel;
  target?.scrollIntoView({ block: 'nearest' });
  target?.focus();
}

export function Workspace({ project }: WorkspaceProps): JSX.Element {
  const { snapshot, error, previewRevision, audioRevision, reload } = useProjectSnapshot(
    project.dir,
  );
  const files = snapshot?.files ?? [];
  const player = usePlayer(playbackAudioUrl(files, audioRevision));
  const { time, duration, playing, fps } = usePlayerState(player);
  const timeline = useTimeline(project.dir, snapshot, reload, audioRevision, duration);
  const stages = useStages(project.dir);
  const reports = useStageReports(project.dir, reportsKey(stages.state));
  const [centerDocument, setCenterDocument] = useState<CenterDocument | null>(null);

  // A project without a brief or a script starts at the brief (new project flow).
  const briefChecked = useRef(false);
  useEffect(() => {
    if (snapshot === undefined || briefChecked.current) return;
    briefChecked.current = true;
    if (!snapshot.files.includes('brief.json') && !snapshot.files.includes('script.txt')) {
      setCenterDocument({ kind: 'script', tab: 'brief' });
    }
  }, [snapshot]);

  const openStage = (target: Exclude<OpenTarget, { kind: 'artifact' }>): void => {
    switch (target.kind) {
      case 'script':
        setCenterDocument({ kind: 'script', tab: 'script' });
        return;
      case 'words':
        setCenterDocument({ kind: 'words' });
        return;
      case 'voiceover':
        setCenterDocument({ kind: 'voiceover' });
        return;
      case 'scenes':
        setCenterDocument({ kind: 'scenes' });
        return;
      case 'shots':
        setCenterDocument(null);
        focusShots();
        return;
    }
  };

  const [selection, setSelection] = useState<ChatSelection | null>(null);
  const storyboard = snapshot?.storyboard;
  const shots = storyboard?.status === 'ok' ? storyboard.data.shots : [];
  const shotUnderPlayhead = shots.findLast((shot) => shot.t0 <= time)?.id ?? shots[0]?.id;
  // The marker shows only on the frame the object was picked on (it may move elsewhere).
  const markerVisible = selection !== null && Math.abs(time - selection.t) < 0.5 / Math.max(fps, 1);

  const selectShot = (shot: StoryboardShot): void => {
    timeline.selection.set([{ kind: 'shot', id: shot.id }]);
    player.seek(shot.t0);
  };

  const running = stages.state?.running ?? null;
  const badges = shotBadges(reports?.scenes ?? null, running);
  const scenesBusy = running?.stage === 'scenes' || stages.state?.queue.includes('scenes') === true;
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const [shotNotice, setShotNotice] = useState<string | undefined>(undefined);

  return (
    <AppShell
      left={
        <div className="left-stack">
          {error !== undefined && (
            <p className="panel-error banner" role="alert">
              {error}
            </p>
          )}
          <PipelineSidebar
            stages={stages}
            onOpen={openStage}
            onBrief={() => {
              setCenterDocument({ kind: 'script', tab: 'brief' });
            }}
          />
          {shotNotice !== undefined && (
            <p className="panel-error banner" role="alert">
              {shotNotice}
            </p>
          )}
          <ShotsPanel
            storyboard={snapshot?.storyboard}
            selectedId={timeline.selectedShotId}
            time={time}
            onSelect={selectShot}
            badges={badges}
            progress={buildProgress(running, shots.length)}
            missingBanner={missingPropsBanner(
              missingProps(reports?.scenes ?? null, reports?.missingProps ?? null),
            )}
            actionsBlocked={scenesBusy ? 'Scenes built is running or queued.' : null}
            onRebuild={(shotId) => {
              setShotNotice(undefined);
              void window.reelforge.runScenes('build', [shotId]).then((result) => {
                if (result.status === 'error') setShotNotice(result.message ?? 'Not started.');
              });
            }}
            onFix={(shotId) => {
              const shot = shots.find((candidate) => candidate.id === shotId);
              if (shot !== undefined) selectShot(shot);
              setPrefill((current) => ({
                text: fixPrompt(shotId, badges.get(shotId)),
                nonce: (current?.nonce ?? 0) + 1,
              }));
            }}
          />
        </div>
      }
      center={
        <div className={`center-stack${centerDocument?.kind === 'scenes' ? ' has-dock' : ''}`}>
          <PreviewPanel
            source={{ kind: 'project', revision: previewRevision }}
            player={player}
            snapshots
            onPick={(pick, x, y) => {
              setSelection(pick === null ? null : toSelection(pick, x, y));
            }}
            marker={
              markerVisible
                ? { x: selection.x, y: selection.y, label: selectionText(selection) }
                : null
            }
          />
          {centerDocument?.kind === 'script' && (
            <ScriptPanel
              project={project}
              stages={stages}
              tab={centerDocument.tab}
              onTab={(tab) => {
                setCenterDocument({ kind: 'script', tab });
              }}
              onClose={() => {
                setCenterDocument(null);
              }}
            />
          )}
          {centerDocument?.kind === 'scenes' && (
            <ScenesPanel
              stages={stages}
              reports={reports}
              totalShots={shots.length}
              onSeekShot={(shotId, t) => {
                timeline.selection.set([{ kind: 'shot', id: shotId }]);
                player.seek(t);
              }}
              onClose={() => {
                setCenterDocument(null);
              }}
            />
          )}
          {centerDocument?.kind === 'voiceover' && (
            <VoiceoverPanel
              stages={stages}
              reports={reports}
              onSeek={(t) => {
                player.seek(t);
              }}
              onClose={() => {
                setCenterDocument(null);
              }}
            />
          )}
          {centerDocument?.kind === 'words' && (
            <WordsPanel
              words={snapshot?.words}
              report={reports?.words ?? null}
              busy={
                stages.state?.running?.stage === 'words' ||
                stages.state?.queue.includes('words') === true
              }
              onSeek={(t) => {
                player.seek(t);
              }}
              onClose={() => {
                setCenterDocument(null);
              }}
            />
          )}
        </div>
      }
      right={
        <ChatPanel
          shotId={timeline.selectedShotId ?? shotUnderPlayhead}
          selection={selection}
          onClearSelection={() => {
            setSelection(null);
          }}
          prefill={prefill}
        />
      }
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
