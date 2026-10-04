/**
 * Beat sync (PLAN.md#12.21): accents, the grid (deterministic, tempo inside the mood's range),
 * cut snapping (never a locked shot, never into a word, at most ±100 ms, still a valid
 * storyboard), the ≥ 90 % report on the example film and a synthetic 8-minute film, and the
 * director's hits on the grid.
 */
import { moodTempoRange } from '@reelforge/pipeline';
import { checkStoryboard } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';
import { syntheticFilm } from '../testing/beat-film.js';
import { EXAMPLE_SOUND_INPUT } from '../testing/sound-films.js';
import { findGestures } from '../sound/cue-events.js';
import { findAccents } from './accents.js';
import { cutRegion, deriveBeatGrid, GridTimes, insideWord } from './grid.js';
import { cutStats, nudgeStats, whooshStats, beatSyncReport } from './report.js';
import { gridForFilm } from './stage.js';
import {
  MAX_CUE_SNAP_S,
  snapCutsToBeats,
  snapGestures,
  snapWhooshCues,
  SNAP_GESTURE_KINDS,
} from './snap.js';
import { BEAT_SYNC_PAUSE_LEAD_S } from './storyboard-step.js';

const STYLE = 'voxel-pixel-crisp640';
const EIGHT_MINUTES = syntheticFilm(480, { cutLeadS: 0.045 });
const EXAMPLE = { shots: [...EXAMPLE_SOUND_INPUT.shots], words: EXAMPLE_SOUND_INPUT.words };
const word = (text: string, t: number, tEnd = t + 0.3) => ({ text, t, tEnd });

describe('accents', () => {
  it('marks phrase openers, numbers, emphasis and sentence ends', () => {
    const accents = findAccents([
      word('So', 0.2),
      word('hackers', 0.52),
      word('rewrote', 0.85),
      word('the', 1.16),
      word('engine.', 1.47),
      word('It', 2.2),
      word('took', 2.52),
      word('61', 2.84),
      word('days,', 3.16),
      word('really', 3.47),
      word('WILD', 3.8),
    ]);
    expect(accents.map((accent) => [accent.word, accent.kind])).toEqual([
      [0, 'phrase'],
      [4, 'final'],
      [5, 'phrase'],
      [7, 'number'],
      [9, 'phrase'],
      [10, 'emphasis'],
    ]);
  });
});

describe('beat grid', () => {
  it('is deterministic, inside the mood tempo range and evenly spaced', () => {
    const film = { ...EIGHT_MINUTES, styleId: STYLE };
    const grid = gridForFilm(film);
    expect(gridForFilm(film)).toEqual(grid);
    expect(grid.acts.length).toBeGreaterThanOrEqual(6);
    for (const act of grid.acts) {
      const [low, high] = moodTempoRange(act.mood === 'retro-wave' ? 'retro-wave' : 'calm-tech');
      if (act.mood === 'calm-tech' || act.mood === 'retro-wave') {
        expect(act.bpm).toBeGreaterThanOrEqual(low);
        expect(act.bpm).toBeLessThanOrEqual(high);
      }
      const beats = grid.beats.filter((t) => t >= act.from && t < act.to);
      const period = 60 / act.bpm;
      beats.slice(1).forEach((t, index) => {
        expect(Math.abs(t - (beats[index] ?? 0) - period)).toBeLessThan(0.002);
      });
    }
    expect([...grid.beats].sort((a, b) => a - b)).toEqual(grid.beats);
  });

  it('follows the speech pace: faster talk gets a faster tempo in the range', () => {
    const words = (spacing: number) =>
      Array.from({ length: 200 }, (_, index) =>
        word('ta', 0.3 + index * spacing, 0.3 + index * spacing + spacing * 0.8),
      );
    const acts = [{ from: 0, to: 60, mood: 'calm-tech' as const }];
    const slow = deriveBeatGrid({ words: words(0.6).filter((w) => w.t < 60), durationS: 60, acts });
    const fast = deriveBeatGrid({
      words: words(0.28).filter((w) => w.t < 60),
      durationS: 60,
      acts,
    });
    expect(fast.acts[0]?.bpm ?? 0).toBeGreaterThan(slow.acts[0]?.bpm ?? 0);
  });
});

describe('cut snapping', () => {
  const grid = new GridTimes(gridForFilm({ ...EIGHT_MINUTES, styleId: STYLE }));

  it('moves unlocked cuts at most 100 ms, only inside their pause, never into a word', () => {
    const snap = snapCutsToBeats(EIGHT_MINUTES.shots, grid, EIGHT_MINUTES.words, new Set());
    expect(snap.nudges.length).toBeGreaterThan(20);
    for (const nudge of snap.nudges) {
      expect(Math.abs(nudge.to - nudge.from)).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(insideWord(EIGHT_MINUTES.words, nudge.to)).toBe(false);
      const region = cutRegion(nudge.from, EIGHT_MINUTES.words);
      expect(region).toBeDefined();
      expect(nudge.to).toBeGreaterThanOrEqual((region?.lo ?? 0) - 1e-9);
      expect(nudge.to).toBeLessThanOrEqual((region?.hi ?? 0) + 1e-9);
    }
    // Contiguous and every shot still at least 1 s long.
    snap.shots.forEach((shot, index) => {
      expect(shot.t1 - shot.t0).toBeGreaterThanOrEqual(1);
      const next = snap.shots[index + 1];
      if (next !== undefined) expect(next.t0).toBe(shot.t1);
    });
  });

  it('never moves a cut next to a locked shot', () => {
    const locked = new Set(
      EIGHT_MINUTES.shots.filter((_, index) => index % 3 === 1).map((s) => s.id),
    );
    const snap = snapCutsToBeats(EIGHT_MINUTES.shots, grid, EIGHT_MINUTES.words, locked);
    expect(snap.locked).toBeGreaterThan(0);
    EIGHT_MINUTES.shots.forEach((shot, index) => {
      if (!locked.has(shot.id)) return;
      expect(snap.shots[index]?.t0).toBe(shot.t0);
      expect(snap.shots[index]?.t1).toBe(shot.t1);
    });
  });

  it('keeps the storyboard valid (word boundaries with the pause rule, lengths, transitions)', () => {
    const snap = snapCutsToBeats(EIGHT_MINUTES.shots, grid, EIGHT_MINUTES.words, new Set());
    const options = {
      words: { version: 1 as const, words: EIGHT_MINUTES.words },
      rules: { pauseLeadS: BEAT_SYNC_PAUSE_LEAD_S },
    };
    const errors = (shots: typeof snap.shots) =>
      checkStoryboard({ version: 1, shots }, options).filter((entry) => entry.severity === 'error');
    expect(errors(EIGHT_MINUTES.shots)).toEqual([]);
    expect(errors(snap.shots)).toEqual([]);
  });

  it.each([
    ['the example film', EXAMPLE],
    ['a synthetic 8-minute film', EIGHT_MINUTES],
  ])('puts >= 90 %% of the cuts of %s on a beat or accent (±1 frame)', (_, film) => {
    const times = new GridTimes(gridForFilm({ ...film, styleId: STYLE }));
    const snap = snapCutsToBeats(film.shots, times, film.words, new Set());
    const stats = cutStats(snap.shots, times);
    expect(stats.fraction).toBeGreaterThanOrEqual(0.9);
    const report = beatSyncReport({ cuts: stats, nudges: nudgeStats(snap, false) });
    expect(report.ok).toBe(true);
    expect(report.nudges?.maxMs ?? 0).toBeLessThanOrEqual(100);
  });

  it('leaves an unsnapped film far below the target (the metric is not vacuous)', () => {
    const times = new GridTimes(gridForFilm({ ...EIGHT_MINUTES, styleId: STYLE }));
    expect(cutStats(EIGHT_MINUTES.shots, times).fraction).toBeLessThan(0.6);
  });
});

describe('sound on the grid', () => {
  const grid = new GridTimes(gridForFilm({ ...EXAMPLE, styleId: STYLE }));
  const gestures = findGestures({
    shots: EXAMPLE.shots,
    words: EXAMPLE.words,
    sceneSfx: [],
    anchors: [],
  });

  it('moves hits and risers (as a whole) by at most 120 ms onto a beat or accent', () => {
    const snapped = snapGestures(gestures, grid);
    expect(snapped.gestures).toHaveLength(gestures.length);
    snapped.gestures.forEach((gesture, index) => {
      const original = gestures[index];
      if (original === undefined) return;
      if (!SNAP_GESTURE_KINDS.has(gesture.kind)) {
        expect(gesture).toBe(original);
        return;
      }
      const deltas = gesture.cues.map((cue, position) => cue.t - (original.cues[position]?.t ?? 0));
      for (const delta of deltas) {
        expect(Math.abs(delta)).toBeLessThanOrEqual(MAX_CUE_SNAP_S + 0.001);
        expect(Math.abs(delta - (deltas[0] ?? 0))).toBeLessThan(0.002);
      }
      const peak = gesture.cues.at(-1)?.t ?? 0;
      if (Math.abs(deltas[0] ?? 0) > 0) expect(grid.nearest(peak, 0.002)).toBeDefined();
    });
  });

  it('counts whooshes peaking on the grid', () => {
    const cut = EXAMPLE.shots[1]?.t0 ?? 0;
    const onGrid = grid.nearest(cut, 0.05);
    const stats = whooshStats(
      [
        { t: cut - 0.25, name: 'whoosh' },
        { t: 3, name: 'pop' },
      ],
      EXAMPLE.shots,
      grid,
    );
    expect(stats.total).toBe(1);
    expect(stats.inWindow).toBe(onGrid === undefined ? 0 : 1);
  });
});

describe('whooshes of the final cues on the grid (scene accents, Claude)', () => {
  // Beats every second; the report reads a whoosh's peak 0.25 s after its start.
  const grid = new GridTimes({ beats: [1, 2, 3, 4, 5, 6, 7, 8], accents: [] });
  const cuts = [6];

  it('moves a whoosh so its peak lands on a beat within 120 ms; other cues stay', () => {
    const cues = [
      { id: 'sfx-01', t: 1.85, name: 'whoosh' }, // peak 2.10 -> 2.00
      { id: 'sfx-02', t: 2.6, name: 'hit' },
      { id: 'sfx-03', t: 3.5, name: 'swoosh-in' }, // peak 3.75: no beat within 120 ms
      { id: 'sfx-04', t: 5.8, name: 'whoosh' }, // runs into the cut at 6 s: follows the cut
      { id: 'sfx-05', t: 6.9, file: 'audio/sfx/x.wav' },
    ];
    const result = snapWhooshCues(cues, grid, cuts, []);
    expect(result.snapped).toBe(1);
    expect(result.cues.map((cue) => cue.t)).toEqual([1.75, 2.6, 3.5, 5.8, 6.9]);
    expect(result.cues[0]).toEqual({ id: 'sfx-01', t: 1.75, name: 'whoosh' });
    expect(result.cues[1]).toBe(cues[1]);
    // The snapped peak sits exactly on the beat (it was 100 ms off); the report's ±120 ms window
    // is the snap window, so its count does not change.
    expect(grid.nearest(1.75 + 0.25, 0.001)).toBe(2);
    const shots = [{ t0: 0 }, { t0: 6 }];
    expect(whooshStats(result.cues, shots, grid).inWindow).toBe(
      whooshStats(cues, shots, grid).inWindow,
    );
  });

  it('never moves a cue matched to a scene anchor beyond ±150 ms of it', () => {
    // Pinned to an anchor at 1.80: 1.75 is 50 ms off (ok); pinned at 1.95: 1.75 would be 200 ms.
    expect(snapWhooshCues([{ t: 1.85, name: 'whoosh' }], grid, [], [1.8]).snapped).toBe(1);
    const pinned = snapWhooshCues([{ t: 1.85, name: 'whoosh' }], grid, [], [1.95]);
    expect(pinned.snapped).toBe(0);
    expect(pinned.cues[0]?.t).toBe(1.85);
  });

  it('does not move a whoosh into a cut (it would peak on the cut instead)', () => {
    const result = snapWhooshCues([{ t: 4.85, name: 'whoosh' }], grid, [5.1], []);
    expect(result.snapped).toBe(0);
  });
});
