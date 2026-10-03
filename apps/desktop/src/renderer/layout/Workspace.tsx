/**
 * The open project's workspace (PLAN.md#6.3): wires the snapshot, the player (shared time, PLAN.md
 * #6.4) and the timeline (selection, edits, waveform; PLAN.md#6.5) into the panels of the shell.
 */
import type { StoryboardShot } from '@reelforge/shared';
import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { LibrarySound } from '../../shared/sound-contract.js';
import { DUCKING_PRESET_VALUES, libraryCue } from '../../shared/sound-library.js';
import type { ChatSelection } from '../../shared/chat-contract.js';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { selectionText, toSelection } from '../chat/step-view.js';
import { playbackAudioUrl } from '../preview/audio-source.js';
import { PreviewPanel } from '../preview/PreviewPanel.js';
import { usePlayer, usePlayerState } from '../preview/use-player.js';
import type { OpenTarget } from '../stages/pipeline-view.js';
import { ScriptPanel, type ScriptTab } from '../stages/ScriptPanel.js';
import { exportPreflight } from '../stages/final-review-view.js';
import { lockableOkShots, outOfSyncLocked } from '../stages/locks-view.js';
import { ScenesPanel } from '../stages/ScenesPanel.js';
import {
  buildProgress,
  fixPrompt,
  propsBanner,
  propsSummary,
  shotBadges,
} from '../stages/scenes-view.js';
import { useShotLocks } from '../stages/use-shot-locks.js';
import { reportsKey, useStageReports } from '../stages/use-stage-reports.js';
import { useStages } from '../stages/use-stages.js';
import { useVariantsDock } from '../stages/use-variants-dock.js';
import { VariantsDockPanel } from '../stages/VariantsPanel.js';
import { VoiceoverPanel } from '../stages/VoiceoverPanel.js';
import { WordsPanel } from '../stages/WordsPanel.js';
import { ExportDialog } from '../export/ExportDialog.js';
import { SoundPanel } from '../sound/SoundPanel.js';
import { useMixPreview } from '../sound/use-mix-preview.js';
import { useSound } from '../sound/use-sound.js';
import { useTimeline } from '../timeline/use-timeline.js';
import { AppShell } from './AppShell.js';
import { ChatPanel } from './ChatPanel.js';
import { PipelineSidebar } from './PipelineSidebar.js';
import { ShotsPanel } from './ShotsPanel.js';
import { TimelinePanel } from './TimelinePanel.js';
import { FileProblemsBanner } from './FileProblemsBanner.js';
import { useProjectSnapshot } from './use-project-snapshot.js';

export interface WorkspaceProps {
  readonly project: ProjectSummary;
  /** Settings → Tools (e.g. a whisper.cpp install problem in the pipeline sidebar). */
  readonly onOpenToolsSettings?: () => void;
}

/** A document shown over the preview (Open of a stage, the brief). */
type CenterDocument =
  | { readonly kind: 'script'; readonly tab: ScriptTab }
  | { readonly kind: 'words' }
  | { readonly kind: 'voiceover' }
  | { readonly kind: 'scenes' }
  | { readonly kind: 'sound' };

/** Brings the Shots panel into view (Open of the Storyboard stage). */
function focusShots(): void {
  const panel = document.querySelector<HTMLElement>('[aria-label="Shots"]');
  const target = panel?.querySelector<HTMLElement>('button') ?? panel;
  target?.scrollIntoView({ block: 'nearest' });
  target?.focus();
}

export function Workspace({ project, onOpenToolsSettings }: WorkspaceProps): JSX.Element {
  const { snapshot, error, previewRevision, audioRevision, reload } = useProjectSnapshot(
    project.dir,
  );
  const files = snapshot?.files ?? [];
  const timeRef = useRef(0);
  const mixPreview = useMixPreview(
    project.dir,
    audioRevision,
    files.includes('audio/mix.wav'),
    () => timeRef.current,
  );
  const player = usePlayer(
    playbackAudioUrl(files, audioRevision, mixPreview.monitor, mixPreview.playing),
  );
  const { time, duration, playing, fps } = usePlayerState(player);
  timeRef.current = time;
  const timeline = useTimeline(project.dir, snapshot, reload, audioRevision, duration);
  const stages = useStages(project.dir);
  const reports = useStageReports(project.dir, reportsKey(stages.state));
  const sound = useSound(project.dir, reportsKey(stages.state));
  const [exportOpen, setExportOpen] = useState(false);
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
      case 'sound':
        setCenterDocument({ kind: 'sound' });
        return;
      case 'export':
        setExportOpen(true);
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

  const closeDocument = useCallback(() => {
    setCenterDocument(null);
  }, []);
  const variants = useVariantsDock({
    dir: project.dir,
    stages: stages.state,
    player,
    time,
    playing,
    shots,
    selectedShotId: timeline.selectedShotId,
    onOpen: closeDocument,
  });
  const variantsOpen = variants.shotId !== null && centerDocument === null;

  const selectShot = (shot: StoryboardShot): void => {
    timeline.selection.set([{ kind: 'shot', id: shot.id }]);
    player.seek(shot.t0);
  };

  const running = stages.state?.running ?? null;
  const badges = shotBadges(reports?.scenes ?? null, running);
  const scenesBusy = running?.stage === 'scenes' || stages.state?.queue.includes('scenes') === true;
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const [shotNotice, setShotNotice] = useState<string | undefined>(undefined);
  const locks = useShotLocks(snapshot?.locks, timeline.selectedShotId, reload);
  const runScenes = (action: 'build' | 'sync-check', shotId: string): void => {
    setShotNotice(undefined);
    void window.reelforge.runScenes(action, [shotId]).then((result) => {
      if (result.status === 'error') setShotNotice(result.message ?? 'Not started.');
    });
  };
  const seekShot = (shotId: string, t: number): void => {
    timeline.selection.set([{ kind: 'shot', id: shotId }]);
    player.seek(t);
  };

  /** A library sound becomes a cue at `t` (drop on the timeline or Add at the playhead). */
  const addSound = (librarySound: LibrarySound, t: number): void => {
    const { track, cue } = libraryCue(librarySound, t, {
      duration: timeline.duration,
      shots,
      ducking: sound.state?.ducking ?? DUCKING_PRESET_VALUES.medium,
    });
    const index = timeline.model.cues[track].length;
    timeline.editing.apply({ file: 'cues', edits: [{ kind: 'insert-cue', track, index, cue }] });
  };

  return (
    <>
      {exportOpen && (
        <ExportDialog
          dir={project.dir}
          playhead={time}
          preflight={exportPreflight(reports?.finalReview ?? null, reports?.scenes ?? null, shots)}
          onSeekShot={(shotId, t) => {
            setExportOpen(false);
            seekShot(shotId, t);
          }}
          onClose={() => {
            setExportOpen(false);
          }}
        />
      )}
      <AppShell
        left={
          <div className="left-stack">
            {error !== undefined && (
              <p className="panel-error banner" role="alert">
                {error}
              </p>
            )}
            <FileProblemsBanner
              dir={project.dir}
              problems={snapshot?.problems ?? []}
              onRepaired={() => {
                void reload();
              }}
            />
            <PipelineSidebar
              stages={stages}
              onOpen={openStage}
              {...(onOpenToolsSettings === undefined
                ? {}
                : { onOpenSettings: onOpenToolsSettings })}
              onBrief={() => {
                setCenterDocument({ kind: 'script', tab: 'brief' });
              }}
            />
            {(shotNotice ?? locks.notice) !== undefined && (
              <p className="panel-error banner" role="alert">
                {shotNotice ?? locks.notice}
              </p>
            )}
            <ShotsPanel
              storyboard={snapshot?.storyboard}
              selectedId={timeline.selectedShotId}
              time={time}
              onSelect={selectShot}
              badges={badges}
              progress={buildProgress(running, shots.length)}
              propsBanner={propsBanner(
                propsSummary(reports?.scenes ?? null, reports?.props ?? null),
              )}
              actionsBlocked={scenesBusy ? 'Scenes built is running or queued.' : null}
              onRebuild={(shotId) => {
                runScenes('build', shotId);
              }}
              locked={locks.locked}
              outOfSync={outOfSyncLocked(
                locks.locked,
                reports?.sync ?? null,
                reports?.finalReview ?? null,
              )}
              lockable={lockableOkShots(shots, badges, locks.locked)}
              onLock={(shotIds, lock) => {
                void locks.setLocked(shotIds, lock);
              }}
              onVariants={variants.open}
              withVariants={variants.withVariants}
              onUnlockAndFix={(shotId) => {
                void locks.setLocked([shotId], false).then((unlocked) => {
                  if (unlocked) runScenes('sync-check', shotId);
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
          <div
            className={`center-stack${variantsOpen || centerDocument?.kind === 'scenes' || centerDocument?.kind === 'sound' ? ' has-dock' : ''}`}
          >
            <PreviewPanel
              source={variants.source(previewRevision)}
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
            {variantsOpen && (
              <VariantsDockPanel dock={variants} stages={stages} locked={locks.locked} />
            )}
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
                shots={shots}
                onSeekShot={seekShot}
                onClose={() => {
                  setCenterDocument(null);
                }}
              />
            )}
            {centerDocument?.kind === 'sound' && (
              <SoundPanel
                sound={sound}
                preview={mixPreview}
                stages={stages.state}
                onAdd={(librarySound) => {
                  addSound(librarySound, time);
                }}
                onOpenStems={() => {
                  void stages.open('stems');
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
            locked={locks.locked}
            waveform={timeline.waveform}
            onSeek={(t) => {
              player.seek(t);
            }}
            onScrub={(t) => {
              player.scrub(t);
            }}
            onDropSound={addSound}
          />
        }
      />
    </>
  );
}
