/**
 * The deterministic sound design of a project (no Claude): acts and their moods, the generated
 * music beds (when enabled and the user has no music of their own), the director's SFX and the
 * ambience, as one `cues.json`. Also re-renders the beds when Claude's turn changed `moods`.
 */
import { readdir } from 'node:fs/promises';
import { ok, type Result } from '@reelforge/claude-bridge';
import {
  MusicCueSchema,
  type CuesFile,
  type CuesFileInput,
  type MusicMood,
} from '@reelforge/pipeline';
import type { BeatsFile, LookMode, StoryboardShot, TensionPoint } from '@reelforge/shared';
import { GridTimes } from '../beat-sync/grid.js';
import { snapGestures } from '../beat-sync/snap.js';
import { FILES, inProject } from '../paths.js';
import {
  defaultDurationS,
  generateDefaultCues,
  type GeneratedMusic,
} from '../stages/default-cues.js';
import type { SceneSfxProvider, StageError } from '../types.js';
import { actMoods, detectActs, type FilmAct } from './acts.js';
import { findGestures, type DirectorWord } from './cue-events.js';
import { isGeneratedMusic, renderActMusic } from './music.js';
import { loadSceneEvents } from './scene-events.js';

const MUSIC_EXTENSIONS = /\.(?:wav|mp3|m4a|ogg|flac)$/i;

export interface SoundDesignInput {
  readonly projectDir: string;
  readonly shots: readonly StoryboardShot[];
  readonly words: readonly DirectorWord[];
  readonly styleId: string;
  /** Project seed (music beds). */
  readonly seed: number;
  readonly musicEnabled: boolean;
  /** The project's look mode: sound palettes per look in `mixed` (absent = `voxel-only`). */
  readonly lookMode?: LookMode | undefined;
  /** The tension map's curve (PLAN.md#12.22): act energy/mood and SFX density; absent = 1.x. */
  readonly tension?: readonly TensionPoint[] | undefined;
  /** Beat grid (PLAN.md#12.21): beds locked to it, hits snapped; absent = beat sync off. */
  readonly beats?: BeatsFile | undefined;
  readonly sceneSfx: SceneSfxProvider | undefined;
  readonly signal: AbortSignal;
  readonly onStep?: ((label: string) => void) | undefined;
}

export interface SoundDesign {
  readonly cues: CuesFileInput;
  readonly durationS: number;
  readonly acts: readonly FilmAct[];
  /** Mood per act of the generated beds; empty when no music was generated. */
  readonly moods: readonly MusicMood[];
  /** The user's own music files used instead of generated beds. */
  readonly userMusic: readonly string[];
  /** The beat grid the design used (beat sync on). */
  readonly beats?: BeatsFile | undefined;
  /** Hits / risers the director's events moved onto the grid. */
  readonly snappedCues: number;
}

/** The user's own music in `audio/music/` (generated beds excluded), sorted. */
export async function userMusicFiles(projectDir: string): Promise<string[]> {
  try {
    const names = await readdir(inProject(projectDir, FILES.musicDir));
    return names
      .filter((name) => MUSIC_EXTENSIONS.test(name) && !isGeneratedMusic(name))
      .sort()
      .map((name) => `${FILES.musicDir}/${name}`);
  } catch {
    return []; // no audio/music folder
  }
}

export async function designSound(
  input: SoundDesignInput,
): Promise<Result<SoundDesign, StageError>> {
  const durationS = defaultDurationS({ shots: input.shots, words: input.words });
  const acts = detectActs(input.shots, durationS, input.tension);
  const userMusic = await userMusicFiles(input.projectDir);
  const scene = await loadSceneEvents(input.projectDir, input.sceneSfx, input.signal);
  let moods: MusicMood[] = [];
  let music: GeneratedMusic | undefined;
  if (input.musicEnabled && userMusic.length === 0 && acts.length > 0) {
    moods = actMoods(acts, input.styleId);
    input.onStep?.(`Composing music (${moods.join(', ')})`);
    const rendered = await renderActMusic(input.projectDir, {
      acts,
      moods,
      seed: input.seed,
      durationS,
      grid: input.beats,
    });
    if (!rendered.ok) return rendered;
    music = { cues: rendered.value, moods };
  }
  const cues = generateDefaultCues({
    shots: input.shots,
    words: input.words,
    sceneSfx: scene.sfx,
    anchors: scene.anchors,
    musicFiles: userMusic,
    music,
    durationS,
    palettes: { lookMode: input.lookMode },
    tension: input.tension,
    ...(input.beats === undefined ? {} : { beats: input.beats }),
  });
  const snappedCues =
    input.beats === undefined
      ? 0
      : snapGestures(
          findGestures({
            shots: input.shots,
            words: input.words,
            sceneSfx: scene.sfx,
            anchors: scene.anchors,
          }),
          new GridTimes(input.beats),
        ).snapped;
  return ok({
    cues,
    durationS,
    acts,
    moods,
    userMusic,
    ...(input.beats === undefined ? {} : { beats: input.beats }),
    snappedCues,
  });
}

const sameMoods = (a: readonly MusicMood[], b: readonly MusicMood[]): boolean =>
  a.length === b.length && a.every((mood, index) => mood === b[index]);

/**
 * Claude's cues with the beds of `cues.moods` (when it changed a mood): generated music cues are
 * replaced by freshly rendered ones (same id), keeping Claude's gain and ducking. Returns null
 * when nothing had to change.
 */
export async function applyMoodHint(
  cues: CuesFile,
  design: SoundDesign,
  input: Pick<SoundDesignInput, 'projectDir' | 'seed'>,
): Promise<Result<CuesFile | null, StageError>> {
  const hint = cues.moods;
  if (design.moods.length === 0 || hint === undefined || hint.length !== design.acts.length) {
    return ok(null);
  }
  if (sameMoods(hint, design.moods)) return ok(null);
  const rendered = await renderActMusic(input.projectDir, {
    acts: design.acts,
    moods: actMoods(design.acts, '', hint),
    seed: input.seed,
    durationS: design.durationS,
    grid: design.beats,
  });
  if (!rendered.ok) return rendered;
  const fresh = new Map(rendered.value.map((cue) => [cue.id, MusicCueSchema.parse(cue)]));
  const music = cues.music.map((cue) => {
    const replacement = cue.id === undefined ? undefined : fresh.get(cue.id);
    if (replacement === undefined || !isGeneratedMusic(cue.file)) return cue;
    return { ...replacement, gainDb: cue.gainDb, ducking: cue.ducking };
  });
  return ok({ ...cues, music });
}
