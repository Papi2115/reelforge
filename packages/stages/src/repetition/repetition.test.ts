/**
 * Repetition control (PLAN.md#12.23): a film with deliberately injected repetitions (visual,
 * template, transition, SFX in a window and twice in a row, a phrase) is fully caught and a clean
 * film reports nothing; thresholds move the verdicts; the analysis is read-only; Apply swaps SFX /
 * transitions without touching locked shots and the repetition goes away; Ignore sticks; with the
 * switch off nothing is analysed or written.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REPETITIONS_FILE,
  repetitionsFileSchema,
  type ProjectFile,
  type StoryboardShot,
} from '@reelforge/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { findRepetitions, type FilmCue, type RepetitionFilm } from './analyse.js';
import { findRepeatedPhrases } from './phrases.js';
import { kitDefinitions } from './signature.js';
import {
  applyRepetition,
  analyseRepetitions,
  reviewRepetitions,
  setRepetitionStatus,
} from './stage.js';

const SHOT_S = 4;
const LOOKS: Readonly<Record<number, string>> = {
  8: 'blueprint',
  10: 'blueprint',
  12: 'blueprint',
};

function shots(): StoryboardShot[] {
  return Array.from({ length: 20 }, (_, index) => {
    const id = `s${String(index + 1).padStart(2, '0')}`;
    const transition =
      index === 6 || index === 8
        ? { transitionIn: { type: 'wipe' as const, duration: 0.4, style: 'pixel-wipe' } }
        : index === 14
          ? {
              transitionIn: { type: 'crossfade' as const, duration: 0.5, style: 'dither-dissolve' },
            }
          : {};
    const look = LOOKS[index + 1];
    return {
      id,
      t0: index * SHOT_S,
      t1: (index + 1) * SHOT_S,
      treatment: index % 2 === 0 ? 'metaphor-object' : 'data-chart-3d',
      intent: id,
      scene: `scenes/${id}.js`,
      ...(look === undefined ? {} : { look }),
      ...transition,
    };
  });
}

function sources(film: readonly StoryboardShot[]): Map<string, string> {
  return new Map(
    film.map((shot, index) => {
      const n = index + 1;
      const body =
        n === 3 || n === 5
          ? 'kit.env.room({}); kit.props.calculator({ screen: "doom" }); kit.env.lights({});'
          : LOOKS[n] !== undefined
            ? `kit.fx.blueprintChart({ kind: 'bar' }); kit.props.unique${String(n)}();`
            : `kit.props.unique${String(n)}({}); kit.env.lights({});`;
      return [shot.id, `export function build(ctx) { const { kit } = ctx; ${body} }`];
    }),
  );
}

const CUES: FilmCue[] = [
  { id: 'sfx-01', t: 20, name: 'whoosh' },
  { id: 'sfx-02', t: 23, name: 'pop' },
  { id: 'sfx-03', t: 27, name: 'whoosh' },
  { id: 'sfx-04', t: 30, name: 'tick' },
  { id: 'sfx-05', t: 34, name: 'whoosh' },
  { id: 'sfx-06', t: 37.5, name: 'hit-soft' },
  { id: 'sfx-07', t: 41, name: 'whoosh' },
  { id: 'sfx-08', t: 60, name: 'ding' },
  { id: 'sfx-09', t: 66, name: 'ding' },
  { id: 'sfx-10', t: 70, name: 'chime' },
];

const spoken = (text: string, t: number) => ({ text, t, tEnd: t + 0.25 });
function words(): { text: string; t: number; tEnd: number }[] {
  const line = (t: number, ...texts: string[]) =>
    texts.map((text, index) => spoken(text, t + index * 0.3));
  return [
    ...line(1, 'Here', 'the', 'old', 'engine', 'starts.'),
    ...line(12, 'Then', 'the', 'old', 'engine', 'stalls.'),
    ...line(25, 'Again', 'the', 'old', 'engine', 'wins.'),
    ...line(44, 'He', 'said', '"the', 'best', 'is', 'yet"', 'and', 'left.'),
    ...line(50, 'She', 'said', '"the', 'best', 'is', 'yet"', 'too.'),
    ...line(56, 'We', 'said', '"the', 'best', 'is', 'yet"', 'again.'),
  ];
}

function film(extra: Partial<RepetitionFilm> = {}): RepetitionFilm {
  const list = shots();
  return {
    shots: list,
    sources: sources(list),
    cues: CUES,
    words: words(),
    lookMode: 'mixed',
    seed: 7,
    ...extra,
  };
}

describe('findRepetitions', () => {
  it('catches every injected repetition (visual, template, transition, SFX x2, phrase)', () => {
    const { items, counts } = findRepetitions(film());
    const found = items.map((entry) => `${entry.kind}:${entry.subject}`);
    const injected = [
      'visual:voxel · metaphor-object · env.room, props.calculator',
      'template:fx.blueprintChart',
      'transition:pixel-wipe',
      'sfx:whoosh',
      'sfx:ding',
      'phrase:the old engine',
    ];
    const caught = injected.filter((key) => found.includes(key));
    expect(caught.length / injected.length).toBeGreaterThanOrEqual(0.9);
    expect(caught).toEqual(injected);
    // Nothing else: quoted lines, different sounds and the lone dither-dissolve are fine.
    expect(items).toHaveLength(injected.length);
    expect(counts).toMatchObject({ visual: 1, template: 1, transition: 1, sfx: 2, phrase: 1 });
    const whoosh = items.find((entry) => entry.subject === 'whoosh');
    expect(whoosh?.occurrences).toHaveLength(4);
    expect(whoosh?.changes.map((change) => change.target)).toEqual(['sfx-03', 'sfx-07']);
    expect(whoosh?.changes.every((change) => change.to !== 'whoosh')).toBe(true);
    const transition = items.find((entry) => entry.kind === 'transition');
    expect(transition?.changes).toEqual([
      { target: 's09', from: 'pixel-wipe', to: expect.any(String) as unknown },
    ]);
    expect(transition?.changes[0]?.to).not.toBe('pixel-wipe');
    expect(items.find((entry) => entry.kind === 'phrase')?.action).toBe('none');
  });

  it('is read-only and deterministic', () => {
    const input = film();
    const before = JSON.stringify({ ...input, sources: [...(input.sources ?? [])] });
    const first = findRepetitions(input);
    expect(JSON.stringify({ ...input, sources: [...(input.sources ?? [])] })).toBe(before);
    expect(findRepetitions(film())).toEqual(first);
  });

  it('never proposes a change in a locked shot', () => {
    const locked = new Set(['s09', 's07', 's05', 's02']);
    const { items } = findRepetitions(film({ locked }));
    for (const entry of items) {
      for (const change of entry.changes) {
        expect(locked.has(change.target)).toBe(false);
      }
    }
    // The whoosh at 27 s lies in locked s07: only the one at 41 s is swapped.
    expect(items.find((entry) => entry.subject === 'whoosh')?.changes.map((c) => c.target)).toEqual(
      ['sfx-07'],
    );
    const transition = items.find((entry) => entry.kind === 'transition');
    expect(transition?.changes).toEqual([]);
    expect(transition?.locked).toBe(true);
  });

  it('follows the thresholds', () => {
    const strict = findRepetitions(film(), { sfxCount: 5, visualWindowS: 5, phraseCount: 4 });
    expect(strict.items.some((entry) => entry.subject === 'whoosh')).toBe(false);
    expect(strict.items.some((entry) => entry.kind === 'visual')).toBe(false);
    expect(strict.items.some((entry) => entry.kind === 'phrase')).toBe(false);
    const loose = findRepetitions(film(), { transitionWindowS: 5, templateCount: 4 });
    expect(loose.items.some((entry) => entry.kind === 'transition')).toBe(false);
    expect(loose.items.some((entry) => entry.kind === 'template')).toBe(false);
  });

  it('reports nothing for a varied film', () => {
    const list = shots().map((shot): StoryboardShot => ({
      ...shot,
      transitionIn: { type: 'cut' },
    }));
    const varied = findRepetitions({
      shots: list,
      sources: new Map(list.map((shot) => [shot.id, `kit.props.${shot.id}x();`])),
      cues: CUES.filter((cue) => cue.name !== 'whoosh' && cue.name !== 'ding'),
      words: words().slice(0, 5),
    });
    expect(varied.items).toEqual([]);
  });
});

describe('wow transitions in repetition control (ADR-028)', () => {
  /** 40 shots of 4 s, cuts except the given transitions (shot index -> transition). */
  function wowFilm(
    into: Readonly<Record<number, StoryboardShot['transitionIn']>>,
    marked: readonly number[] = [],
  ): RepetitionFilm {
    const list = Array.from({ length: 40 }, (_, index): StoryboardShot => {
      const id = `w${String(index).padStart(2, '0')}`;
      const transitionIn = into[index];
      return {
        id,
        t0: index * SHOT_S,
        t1: (index + 1) * SHOT_S,
        treatment: 'map',
        intent: id,
        scene: `scenes/${id}.js`,
        ...(transitionIn === undefined ? {} : { transitionIn }),
        ...(marked.includes(index) ? { scaleSequence: true } : {}),
      };
    });
    return { shots: list, lookMode: 'mixed', seed: 3 };
  }
  const wow = (style: string): StoryboardShot['transitionIn'] => ({
    type: 'glitch',
    duration: 1,
    style,
  });

  it('counts the same wow style within 90 s as a repeat and proposes a plain style', () => {
    const { items } = findRepetitions(wowFilm({ 3: wow('shatter'), 20: wow('shatter') }));
    const repeat = items.find((entry) => entry.kind === 'transition');
    expect(repeat?.subject).toBe('shatter');
    expect(repeat?.occurrences.map((entry) => entry.shotId)).toEqual(['w03', 'w20']);
    expect(repeat?.changes).toEqual([
      { target: 'w20', from: 'shatter', to: expect.any(String) as unknown },
    ]);
    expect(repeat?.changes[0]?.to).not.toBe('shatter');
    // 23 shots of 4 s apart (92 s): no longer a repeat; plain styles keep their 20-s window.
    expect(findRepetitions(wowFilm({ 3: wow('shatter'), 26: wow('shatter') })).items).toEqual([]);
  });

  it('does not count the dives of a scale sequence as repeats', () => {
    const chain = { 10: wow('dive-out'), 11: wow('dive-out'), 12: wow('dive-out') };
    expect(findRepetitions(wowFilm(chain, [9, 10, 11, 12])).items).toEqual([]);
    expect(findRepetitions(wowFilm(chain)).items.map((entry) => entry.subject)).toEqual([
      'dive-out',
    ]);
  });
});

describe('signatures and phrases', () => {
  it('scans kit definitions (common ones dropped)', () => {
    expect(
      kitDefinitions(
        'kit.env.lights({}); kit.props.bench(); kit . props . bench(); kit.fx.blueprintChart({})',
      ),
    ).toEqual(['fx.blueprintChart', 'props.bench']);
  });

  it('reports a longer repeated phrase once and skips quotations', () => {
    const phrase = (t: number) =>
      ['the', 'tiny', 'old', 'engine', 'ran'].map((text, index) => spoken(text, t + index * 0.3));
    const found = findRepeatedPhrases([...phrase(0), ...phrase(10), ...phrase(20)], {
      phraseWords: 3,
      phraseCount: 3,
      phraseWindowS: 60,
    });
    expect(found.map((entry) => entry.phrase)).toEqual(['the tiny old']);
  });
});

describe('repetitions in a project', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rf repetition żółw '));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });
  const project: ProjectFile = {
    version: 1,
    title: 'Repeats',
    language: 'en',
    style: 'voxel-pixel-crisp640',
    fps: 30,
    seed: 7,
    lookMode: 'mixed',
    repetitionControl: 'auto',
  };

  function setup(name: string, locked: readonly string[] = []): string {
    const dir = path.join(root, name);
    mkdirSync(path.join(dir, 'scenes'), { recursive: true });
    mkdirSync(path.join(dir, 'timing'), { recursive: true });
    const input = film();
    writeFileSync(
      path.join(dir, 'storyboard.json'),
      JSON.stringify({ version: 1, shots: input.shots, extra: 'kept' }, null, 2),
    );
    for (const [id, source] of input.sources ?? []) {
      writeFileSync(path.join(dir, 'scenes', `${id}.js`), source);
    }
    const sfx = CUES.map((cue) => ({ ...cue, gainDb: -12, pan: 0, seed: 3, durationS: 0.5 }));
    writeFileSync(path.join(dir, 'cues.json'), JSON.stringify({ version: 1, sfx }, null, 2));
    writeFileSync(
      path.join(dir, 'timing', 'words.json'),
      JSON.stringify({ version: 1, words: input.words }),
    );
    writeFileSync(
      path.join(dir, 'locks.json'),
      JSON.stringify({
        version: 1,
        shots: locked.map((shotId) => ({ shotId, lockedAt: '2026-10-04T08:00:00.000Z' })),
      }),
    );
    return dir;
  }

  const read = (dir: string, file: string): unknown =>
    JSON.parse(readFileSync(path.join(dir, ...file.split('/')), 'utf8'));

  it('Apply swaps the SFX outside locked shots and the repetition is gone', async () => {
    const dir = setup('sfx', ['s07']);
    const analysed = await analyseRepetitions(dir, project);
    expect(analysed.ok).toBe(true);
    if (!analysed.ok) return;
    const whoosh = analysed.value.items.find((entry) => entry.subject === 'whoosh');
    expect(whoosh).toBeDefined();
    const applied = await applyRepetition(dir, project, whoosh?.id ?? '');
    expect(applied.ok, JSON.stringify(applied)).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.files).toEqual(['cues.json']);
    const cues = read(dir, 'cues.json') as {
      sfx: { id: string; name: string; durationS: number }[];
    };
    const byId = new Map(cues.sfx.map((cue) => [cue.id, cue]));
    expect(byId.get('sfx-03')?.name).toBe('whoosh'); // s07 is locked
    expect(byId.get('sfx-07')?.name).not.toBe('whoosh');
    expect(byId.get('sfx-07')?.durationS).toBe(0.5);
    const after = applied.value.repetitions.items.filter((entry) => entry.subject === 'whoosh');
    expect(after.every((entry) => entry.occurrences.length < 4)).toBe(true);
  });

  it('Apply re-picks the transition, leaves other fields, and Ignore sticks across analyses', async () => {
    const dir = setup('transition');
    const analysed = await analyseRepetitions(dir, project);
    if (!analysed.ok) throw new Error(analysed.error.message);
    const transition = analysed.value.items.find((entry) => entry.kind === 'transition');
    const applied = await applyRepetition(dir, project, transition?.id ?? '');
    expect(applied.ok).toBe(true);
    const storyboard = read(dir, 'storyboard.json') as {
      extra: string;
      shots: { id: string; transitionIn?: { style?: string } }[];
    };
    expect(storyboard.extra).toBe('kept');
    expect(storyboard.shots.find((shot) => shot.id === 's07')?.transitionIn?.style).toBe(
      'pixel-wipe',
    );
    expect(storyboard.shots.find((shot) => shot.id === 's09')?.transitionIn?.style).not.toBe(
      'pixel-wipe',
    );
    if (!applied.ok) return;
    expect(applied.value.repetitions.items.some((entry) => entry.kind === 'transition')).toBe(
      false,
    );

    const phrase = applied.value.repetitions.items.find((entry) => entry.kind === 'phrase');
    const ignored = await setRepetitionStatus(dir, phrase?.id ?? '', 'ignored');
    expect(ignored.ok).toBe(true);
    const again = await analyseRepetitions(dir, project);
    if (!again.ok) throw new Error(again.error.message);
    expect(again.value.items.find((entry) => entry.id === phrase?.id)?.status).toBe('ignored');
    expect(again.value.counts.open).toBe(again.value.items.length - 1);
  });

  it('Apply on a visual repeat queues a variant build for the unlocked shot only', async () => {
    const dir = setup('visual');
    const analysed = await analyseRepetitions(dir, project);
    if (!analysed.ok) throw new Error(analysed.error.message);
    const visual = analysed.value.items.find((entry) => entry.kind === 'visual');
    const applied = await applyRepetition(dir, project, visual?.id ?? '');
    if (!applied.ok) throw new Error(applied.error.message);
    expect(applied.value.files).toEqual([]);
    expect(applied.value.requests).toEqual([
      {
        stage: 'scenes',
        action: 'variants',
        shots: ['s05'],
        variants: { kind: 'generate', count: 2, note: expect.stringContaining('s03') as unknown },
      },
    ]);
    const file = repetitionsFileSchema.parse(read(dir, REPETITIONS_FILE));
    expect(file.items.find((entry) => entry.id === visual?.id)?.status).toBe('applied');
  });

  it('with the switch off nothing is analysed or written', async () => {
    const dir = setup('off');
    const legacy: ProjectFile = { ...project, repetitionControl: 'off' };
    expect(await reviewRepetitions(dir, { status: 'ok', value: legacy })).toEqual([]);
    expect(existsSync(path.join(dir, ...REPETITIONS_FILE.split('/')))).toBe(false);
    expect(await reviewRepetitions(dir, { status: 'ok', value: project })).toEqual([
      expect.stringContaining('Repetitions: 6 open') as unknown,
    ]);
  });
});
