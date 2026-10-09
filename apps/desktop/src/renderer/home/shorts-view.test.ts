import { describe, expect, it } from 'vitest';
import { card } from './home-test-cards.js';
import {
  eligibleFilms,
  hiddenFilmsNote,
  NEW_SHORT_WIZARD,
  nextShortStep,
  shortCardProject,
  shortEligibility,
  shortGroups,
  shortsRequest,
  shortsReview,
  shortStepProblem,
} from './shorts-view.js';

const film = card('Heist', { hasScript: true, updatedAt: '2026-10-08T10:00:00.000Z' });
const other = card('Ocean', { hasScript: true });
const short = (title: string, parent: string, lengthS: number, updatedAt: string) =>
  card(title, {
    kind: 'short',
    parentDir: parent,
    parentTitle: 'Old title',
    short: { lengthS, captions: false, endCardText: 'Full video on YT: Crime' },
    updatedAt,
  });

describe('shortGroups', () => {
  it('groups Shorts under their film, 30 s first, the group edited last first', () => {
    const groups = shortGroups([
      film,
      other,
      short('Heist 60', film.dir, 60, '2026-10-01T00:00:00.000Z'),
      short('Ocean 30', other.dir.toUpperCase(), 30, '2026-10-05T00:00:00.000Z'),
      short('Heist 30', film.dir, 30, '2026-10-02T00:00:00.000Z'),
      short('Lost 30', 'C:\\Gone\\Lost', 30, '2026-09-01T00:00:00.000Z'),
    ]);
    expect(
      groups.map((group) => [group.filmTitle, group.film?.title, group.shorts.map((s) => s.title)]),
    ).toEqual([
      ['Ocean', 'Ocean', ['Ocean 30']],
      ['Heist', 'Heist', ['Heist 30', 'Heist 60']],
      ['Old title', undefined, ['Lost 30']],
    ]);
    expect(shortGroups([film, other])).toEqual([]);
  });

  it('shows a Short’s planned length until its storyboard has one', () => {
    const planned = short('S', film.dir, 60, '2026-10-01T00:00:00.000Z');
    expect(shortCardProject(planned).durationS).toBe(60);
    expect(shortCardProject({ ...planned, durationS: 58.5 }).durationS).toBe(58.5);
  });
});

describe('films that can have Shorts', () => {
  it('needs a film with a script in a voxel or Comic style', () => {
    const noScript = card('Draft');
    const sketch = card('Sketch', { hasScript: true, style: 'sketchbook' });
    const comic = card('Comic', { hasScript: true, style: 'comic' });
    const gone = card('Gone', { hasScript: true, exists: false });
    expect(shortEligibility(film)).toBe('ok');
    expect(shortEligibility(comic)).toBe('ok');
    expect(shortEligibility(noScript)).toBe('no-script');
    expect(shortEligibility(sketch)).toBe('unsupported');
    expect(shortEligibility(gone)).toBe('missing');
    expect(shortEligibility(short('S', film.dir, 30, ''))).toBe('not-a-film');
    const all = [film, noScript, sketch, comic, gone];
    expect(eligibleFilms(all).map((entry) => entry.title)).toEqual(['Heist', 'Comic']);
    expect(hiddenFilmsNote(all)).toBe(
      'Not listed: 1 without a script yet, 1 in another style. Shorts are available for voxel and Comic films for now.',
    );
    expect(hiddenFilmsNote([film])).toBeNull();
  });
});

describe('the Short wizard', () => {
  it('waits for a film and for the hint when steering', () => {
    expect(shortStepProblem('film', NEW_SHORT_WIZARD, [])).toBe('No film can have Shorts yet.');
    expect(shortStepProblem('film', NEW_SHORT_WIZARD, [film])).toBe('Pick a film.');
    const picked = { ...NEW_SHORT_WIZARD, filmDir: film.dir };
    expect(shortStepProblem('film', picked, [film])).toBeUndefined();
    expect(shortStepProblem('angle', picked, [film])).toBeUndefined();
    const steer = { ...picked, angle: 'steer' as const };
    expect(shortStepProblem('angle', steer, [film])).toBe(
      'Write the angle hint, or pick “Two different angles”.',
    );
    expect(shortStepProblem('angle', { ...steer, hint: 'x'.repeat(161) }, [film])).toBe(
      'Keep the hint under 160 characters.',
    );
    expect(nextShortStep('film', 1)).toBe('angle');
    expect(nextShortStep('create', 1)).toBeUndefined();
    expect(nextShortStep('film', -1)).toBeUndefined();
  });

  it('reviews and builds the request', () => {
    const state = {
      filmDir: film.dir,
      angle: 'steer' as const,
      hint: ' the vault ',
      captions: true,
    };
    expect(shortsReview(state, film, 'Crime')).toEqual([
      { label: 'Film', value: 'Heist' },
      { label: 'Shorts', value: '30 s + 60 s, vertical 9:16' },
      { label: 'Angle', value: 'Steered toward: the vault' },
      { label: 'End card', value: 'Full video on YT: Crime' },
      { label: 'Captions', value: 'Word by word' },
    ]);
    expect(shortsRequest(state)).toEqual({ dir: film.dir, captions: true, angleHint: 'the vault' });
    expect(shortsRequest({ ...state, angle: 'auto' })).toEqual({ dir: film.dir, captions: true });
    expect(shortsRequest(NEW_SHORT_WIZARD)).toBeUndefined();
  });
});
