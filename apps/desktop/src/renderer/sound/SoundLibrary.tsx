/**
 * The Sound panel's library (PLAN.md#8.2): built-in SFX / ambience recipes and the user's files
 * per kind, each with a play button (a short WAV rendered by main), "Add at playhead" and drag
 * onto the timeline (the drop becomes an `insert-cue` edit). Import copies files into the kind's
 * folder of the project.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { projectMediaUrl } from '../../shared/player-contract.js';
import { SOUND_KINDS, type LibrarySound, type SoundKind } from '../../shared/sound-contract.js';
import { soundLabel } from '../../shared/sound-library.js';
import { errorMessage, rendererLog } from '../log.js';
import {
  encodeSoundDrag,
  KIND_LABELS,
  libraryByKind,
  SOUND_DRAG_TYPE,
  soundKey,
} from './sound-view.js';

const log = rendererLog('sound-library');

export interface SoundLibraryProps {
  readonly library: readonly LibrarySound[];
  readonly preview: (sound: LibrarySound) => Promise<string | null>;
  readonly onAdd: (sound: LibrarySound) => void;
  readonly onImport: (kind: SoundKind) => void;
}

const EMPTY: Readonly<Record<SoundKind, string>> = {
  sfx: 'No sound effects.',
  ambience: 'No ambience loops.',
  music: 'No music yet: import a track (wav, mp3, m4a, ogg, flac).',
};

/** One audio element for every preview; a new play stops the previous one. */
function usePreviewPlayer(): {
  readonly playing: string | null;
  readonly play: (key: string, file: string) => void;
  readonly stop: () => void;
} {
  const audio = useRef<HTMLAudioElement | null>(null);
  const plays = useRef(0);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );
  const stop = (): void => {
    audio.current?.pause();
    setPlaying(null);
  };
  const play = (key: string, file: string): void => {
    audio.current?.pause();
    plays.current += 1;
    const element = new Audio(projectMediaUrl(file, plays.current));
    element.addEventListener('ended', () => {
      setPlaying((current) => (current === key ? null : current));
    });
    audio.current = element;
    setPlaying(key);
    element.play().catch((error: unknown) => {
      log.warn(`preview of ${file} did not play: ${errorMessage(error)}`);
      setPlaying(null);
    });
  };
  return { playing, play, stop };
}

export function SoundLibrary(props: SoundLibraryProps): JSX.Element {
  const [kind, setKind] = useState<SoundKind>('sfx');
  const player = usePreviewPlayer();
  const groups = libraryByKind(props.library);
  const sounds = groups[kind];

  const toggle = (sound: LibrarySound): void => {
    const key = soundKey(sound);
    if (player.playing === key) {
      player.stop();
      return;
    }
    void props.preview(sound).then((file) => {
      if (file !== null) player.play(key, file);
    });
  };

  return (
    <div className="sound-library">
      <div className="sound-tabs" role="tablist" aria-label="Sound kinds">
        {SOUND_KINDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={kind === id}
            className="sound-tab"
            onClick={() => {
              setKind(id);
            }}
          >
            {KIND_LABELS[id]} <span className="count">{groups[id].length}</span>
          </button>
        ))}
      </div>
      <ul className="sound-list" role="tabpanel" aria-label={`${KIND_LABELS[kind]} sounds`}>
        {sounds.length === 0 && <li className="muted sound-empty">{EMPTY[kind]}</li>}
        {sounds.map((sound) => {
          const key = soundKey(sound);
          const label = soundLabel(sound);
          return (
            <li
              key={key}
              className="sound-item"
              draggable
              title={`Drag ${label} onto the timeline`}
              onDragStart={(event) => {
                event.dataTransfer.setData(SOUND_DRAG_TYPE, encodeSoundDrag(sound));
                event.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <button
                type="button"
                className="icon-button"
                aria-label={`${player.playing === key ? 'Stop' : 'Play'} ${label}`}
                onClick={() => {
                  toggle(sound);
                }}
              >
                {player.playing === key ? '■' : '▶'}
              </button>
              <span className="sound-name">{label}</span>
              {sound.source === 'builtin' && <span className="chip">built-in</span>}
              <button
                type="button"
                className="small-button"
                aria-label={`Add ${label} at the playhead`}
                onClick={() => {
                  props.onAdd(sound);
                }}
              >
                Add
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sound-library-footer">
        <button
          type="button"
          className="small-button"
          onClick={() => {
            props.onImport(kind);
          }}
        >
          Import {KIND_LABELS[kind]} files…
        </button>
        <span className="muted" title="Drag a sound onto the timeline, or Add it at the playhead">
          Drag onto the timeline
        </span>
      </div>
    </div>
  );
}
