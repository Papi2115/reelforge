/**
 * The document shown over (or docked under) the preview (PLAN.md#6.3): the brief and script, the
 * voiceover, the words, Scenes built and Sound design. Split out of Workspace.tsx.
 */
import type { StoryboardShot, WordsFile } from '@reelforge/shared';
import type { JSX } from 'react';
import type { LibrarySound } from '../../shared/sound-contract.js';
import type { FileState } from '../../shared/snapshot-contract.js';
import type { StageReports } from '../../shared/voiceover-contract.js';
import type { ProjectSummary } from '../../shared/project-contract.js';
import { ScenesPanel } from '../stages/ScenesPanel.js';
import { ScriptPanel, type ScriptTab } from '../stages/ScriptPanel.js';
import type { StagesControls } from '../stages/use-stages.js';
import { VoiceoverPanel } from '../stages/VoiceoverPanel.js';
import { WordsPanel } from '../stages/WordsPanel.js';
import { SoundPanel } from '../sound/SoundPanel.js';
import type { MixPreviewControls } from '../sound/use-mix-preview.js';
import type { SoundControls } from '../sound/use-sound.js';

/** A document shown over the preview (Open of a stage, the brief). */
export type CenterDocumentKind =
  | { readonly kind: 'script'; readonly tab: ScriptTab }
  | { readonly kind: 'words' }
  | { readonly kind: 'voiceover' }
  | { readonly kind: 'scenes' }
  | { readonly kind: 'sound' };

export interface CenterDocumentProps {
  readonly document: CenterDocumentKind;
  readonly project: ProjectSummary;
  readonly stages: StagesControls;
  readonly reports: StageReports | undefined;
  readonly shots: readonly StoryboardShot[];
  readonly words: FileState<WordsFile> | undefined;
  readonly sound: SoundControls;
  readonly mixPreview: MixPreviewControls;
  readonly onTab: (tab: ScriptTab) => void;
  readonly onSeek: (t: number) => void;
  readonly onSeekShot: (shotId: string, t: number) => void;
  readonly onAddSound: (sound: LibrarySound) => void;
  readonly onClose: () => void;
}

export function CenterDocument(props: CenterDocumentProps): JSX.Element {
  const { document, stages, reports, onClose } = props;
  switch (document.kind) {
    case 'script':
      return (
        <ScriptPanel
          project={props.project}
          stages={stages}
          tab={document.tab}
          onTab={props.onTab}
          onClose={onClose}
        />
      );
    case 'scenes':
      return (
        <ScenesPanel
          stages={stages}
          reports={reports}
          shots={props.shots}
          onSeekShot={props.onSeekShot}
          onClose={onClose}
        />
      );
    case 'sound':
      return (
        <SoundPanel
          sound={props.sound}
          preview={props.mixPreview}
          stages={stages.state}
          onAdd={props.onAddSound}
          onOpenStems={() => {
            void stages.open('stems');
          }}
          onClose={onClose}
        />
      );
    case 'voiceover':
      return (
        <VoiceoverPanel stages={stages} reports={reports} onSeek={props.onSeek} onClose={onClose} />
      );
    case 'words':
      return (
        <WordsPanel
          words={props.words}
          report={reports?.words ?? null}
          busy={
            stages.state?.running?.stage === 'words' ||
            stages.state?.queue.includes('words') === true
          }
          onSeek={props.onSeek}
          onClose={onClose}
        />
      );
  }
}
