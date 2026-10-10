/**
 * `ctx.film` (PLAN.md#14.19): the shot's place in the whole film, for running gags, counters and
 * motifs that span shots. Built from the shot's place in the manifest (`filmPlaceOf`) and the
 * scene's local time; the film-wide anchor resolves the nth occurrence of the whole narration.
 * Pure: the same place and local time give the same value.
 */
import type { FilmPlaceFile } from '@reelforge/shared';
import type { AnchorResolver } from './anchors.js';
import type { AnchorHit, FilmInfo } from './contract.js';
import { EngineError } from './errors.js';

/** Where a shot sits in its film. */
export interface FilmPlace {
  /** Film length in seconds. */
  readonly duration: number;
  readonly shotIndex: number;
  readonly shotCount: number;
}

/** What `filmPlaceOf` reads of a render manifest. */
export interface FilmManifest {
  readonly film?: FilmPlaceFile | undefined;
  readonly shots: readonly { readonly t1: number; readonly filmIndex?: number | undefined }[];
}

/**
 * The place of the manifest's shot `index`: the manifest's own `film` (an isolated render of one
 * shot carries the storyboard's) or, without one, the manifest itself (the whole film).
 */
export function filmPlaceOf(manifest: FilmManifest, index: number): FilmPlace {
  const last = manifest.shots.at(-1);
  const shot = manifest.shots[index];
  return {
    duration: manifest.film?.duration ?? last?.t1 ?? 0,
    shotIndex: shot?.filmIndex ?? index,
    shotCount: manifest.film?.shotCount ?? manifest.shots.length,
  };
}

/** A standalone shot: the film is the shot. */
export function standaloneFilmPlace(duration: number): FilmPlace {
  return { duration, shotIndex: 0, shotCount: 1 };
}

/** `ctx.film.anchor`: film seconds of the nth occurrence anywhere in the narration. */
export function filmAnchor(
  resolve: AnchorResolver,
  shotId: string,
): (phrase: string, nth?: number) => AnchorHit {
  return (phrase, nth = 1) => {
    const span = resolve(phrase, nth);
    if (span === undefined) {
      throw new EngineError(
        'anchor-not-found',
        `film.anchor("${phrase}", ${String(nth)}) is not spoken in words.json; use a phrase copied from the script`,
        { shotId },
      );
    }
    return { t: span.t, tEnd: span.tEnd };
  };
}

/** The frozen `ctx.film` of one context (build: local time 0). */
export function createFilmInfo(
  place: FilmPlace,
  shotT0: number,
  localTime: number,
  anchor: FilmInfo['anchor'],
): FilmInfo {
  const t = shotT0 + localTime;
  const progress = place.duration > 0 ? Math.min(1, Math.max(0, t / place.duration)) : 0;
  return Object.freeze({
    t,
    duration: place.duration,
    progress,
    shotIndex: place.shotIndex,
    shotCount: place.shotCount,
    shotT0,
    anchor,
  });
}
