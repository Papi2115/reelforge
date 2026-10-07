/**
 * The workspace's bottom stack (Workspace.tsx): the timeline and, under it, the tension panel
 * (PLAN.md#12.22) when it is open and the film has timed words.
 */
import type { StoryboardShot } from '@reelforge/shared';
import type { JSX } from 'react';
import type { LibrarySound } from '../../shared/sound-contract.js';
import type { Player } from '../preview/player.js';
import { TensionPanel } from '../tension/TensionPanel.js';
import type { TensionController } from '../tension/use-tension.js';
import type { TimelineState } from '../timeline/use-timeline.js';
import { TimelinePanel } from './TimelinePanel.js';

/** Open/closed of the tension panel (remembered, Workspace.tsx). */
export interface TensionPrefs {
  readonly open: boolean;
}

export interface WorkspaceBottomProps {
  readonly timeline: TimelineState;
  readonly player: Player;
  readonly time: number;
  readonly playing: boolean;
  readonly fps: number;
  readonly locked: ReadonlySet<string>;
  readonly onDropSound: (sound: LibrarySound, t: number) => void;
  readonly tensionPrefs: TensionPrefs;
  readonly setTensionPrefs: (
    update: TensionPrefs | ((current: TensionPrefs) => TensionPrefs),
  ) => void;
  readonly tension: TensionController;
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly { readonly t: number }[];
  readonly tensionMapOn: boolean | undefined;
}

export function WorkspaceBottom(props: WorkspaceBottomProps): JSX.Element {
  const { timeline, player, time, playing, fps, tensionPrefs, setTensionPrefs } = props;
  const { tension, shots, words, tensionMapOn } = props;
  return (
    <div className="bottom-stack">
      <TimelinePanel
        model={timeline.model}
        duration={timeline.duration}
        time={time}
        playing={playing}
        fps={fps}
        selection={timeline.selection}
        editing={timeline.editing}
        locked={props.locked}
        waveform={timeline.waveform}
        onSeek={(t) => {
          player.seek(t);
        }}
        onScrub={(t) => {
          player.scrub(t);
        }}
        onDropSound={props.onDropSound}
        tensionOpen={tensionPrefs.open}
        onToggleTension={() => {
          setTensionPrefs((current) => ({ open: !current.open }));
        }}
      />
      {tensionPrefs.open && words.length > 0 && (
        <TensionPanel
          tension={tension}
          shots={shots}
          words={words}
          durationS={timeline.duration}
          time={time}
          locked={props.locked}
          mapOn={tensionMapOn}
          onSeek={(t) => {
            player.seek(t);
          }}
          onClose={() => {
            setTensionPrefs({ open: false });
          }}
        />
      )}
    </div>
  );
}
