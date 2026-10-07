import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  storyboardFileSchema,
  wordsFileSchema,
  type StoryboardShot,
  type YoutubeMetaFile,
} from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { MIN_CHAPTER_SECONDS } from '../export/chapters.js';
import {
  boundaryStrength,
  chapterTitle,
  isStoryboardJargon,
  planChapterStarts,
} from './chapter-plan.js';
import {
  buildPublishKit,
  publishChapters,
  publishTags,
  type PublishKitInput,
} from './publish-kit.js';

const EXAMPLE_DIR = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'templates',
  'examples',
  'doom-on-a-calculator',
);
const EXAMPLE = storyboardFileSchema.parse(
  JSON.parse(readFileSync(path.join(EXAMPLE_DIR, 'storyboard.json'), 'utf8')),
).shots;
const SCRIPT = readFileSync(path.join(EXAMPLE_DIR, 'script.txt'), 'utf8');
const WORDS = wordsFileSchema.parse(
  JSON.parse(readFileSync(path.join(EXAMPLE_DIR, 'timing', 'words.json'), 'utf8')),
).words;
/** The example storyboard stretched 10x: a 5-minute film with the same shot structure. */
const LONG = EXAMPLE.map((shot) => ({ ...shot, t0: shot.t0 * 10, t1: shot.t1 * 10 }));

function shot(index: number, length: number, extra: Partial<StoryboardShot> = {}): StoryboardShot {
  return {
    id: `s${String(index)}`,
    t0: index * length,
    t1: (index + 1) * length,
    treatment: 'kinetic-text',
    intent: `Shot number ${String(index)}: details`,
    scene: `scenes/s${String(index)}.js`,
    ...extra,
  };
}

function expectYoutubeRules(
  chapters: readonly { t: number }[],
  shots: readonly StoryboardShot[],
  durationS: number,
): void {
  expect(chapters.length).toBeGreaterThanOrEqual(3);
  expect(chapters[0]?.t).toBe(0);
  chapters.forEach((chapter, index) => {
    const end = chapters[index + 1]?.t ?? durationS;
    expect(Math.floor(end) - Math.floor(chapter.t)).toBeGreaterThanOrEqual(MIN_CHAPTER_SECONDS);
    if (index > 0) expect(shots.some((candidate) => candidate.t0 === chapter.t)).toBe(true);
  });
}

describe('publish chapters', () => {
  it('reports why the 30 s example project gets no chapters', () => {
    expect(publishChapters({ shots: EXAMPLE, durationS: 30.5, meta: null })).toEqual({
      chapters: [],
      text: null,
      problem: 'no split at shot boundaries gives 3+ chapters of 10 s or more (video 30 s)',
    });
  });

  it('chapters the example storyboard at 5 minutes: shot starts, merged, ≤ 5-word titles', () => {
    const result = publishChapters({ shots: LONG, durationS: 305, meta: null });
    expect(result.text).toBe(
      [
        '0:00 Doom runs on almost anything',
        '0:49 A school calculator',
        '1:53 Four megabytes needed',
        '2:54 The hero points',
        '3:46 Push into the calculator screen',
        '4:30 Closing card',
        '',
      ].join('\n'),
    );
    expectYoutubeRules(result.chapters, LONG, 305);
    for (const chapter of result.chapters) {
      expect(chapter.title.split(' ').length).toBeLessThanOrEqual(5);
    }
  });

  it('merges many short shots into a few chapters near the target length', () => {
    const shots = Array.from({ length: 60 }, (_, index) => shot(index, 3));
    const result = publishChapters({ shots, durationS: 180, meta: null });
    expect(result.chapters.map((chapter) => chapter.t)).toEqual([0, 60, 120]);
    expectYoutubeRules(result.chapters, shots, 180);
  });

  it('keeps about one chapter a minute when every cut is an act change (real run 2.3)', () => {
    const looks = ['voxel', 'flat-2d', 'blueprint', 'retro-ui'];
    const shots = Array.from({ length: 29 }, (_, index) =>
      shot(index, 4.8, {
        look: looks[index % looks.length] ?? 'voxel',
        roll: index % 2 === 0 ? 'A' : 'B',
        ...(index > 0 ? { transitionIn: { type: 'wipe', duration: 0.4 } } : {}),
      }),
    );
    const starts = planChapterStarts(shots, 139);
    expect(starts.ok && starts.starts.length).toBeGreaterThanOrEqual(3);
    expect(starts.ok && starts.starts.length).toBeLessThanOrEqual(4);
  });

  it('cuts at act changes (look change, title card) when they are near the target', () => {
    const shots = Array.from({ length: 30 }, (_, index) =>
      shot(index, 6, index === 9 ? { look: 'retro-ui', roll: 'B', treatment: 'title-card' } : {}),
    );
    expect(boundaryStrength(shots, 9)).toBeGreaterThan(boundaryStrength(shots, 10));
    const starts = planChapterStarts(shots, 180);
    expect(starts.ok && starts.starts).toContain(9);
  });

  it('titles chapters with the key phrase spoken at their start (timed words)', () => {
    const words = WORDS.map((word) => ({ ...word, t: word.t * 10, tEnd: word.tEnd * 10 }));
    const result = publishChapters({ shots: LONG, durationS: 305, meta: null, words });
    expect(result.text).toBe(
      [
        '0:00 Doom Runs',
        '0:49 School Calculator',
        '1:53 Original Game Needed Four Megabytes',
        '2:54 Hackers Rewrote',
        '3:46 Demons and Shotguns',
        '4:30 Runs Doom',
        '',
      ].join('\n'),
    );
    expectYoutubeRules(result.chapters, LONG, 305);
  });

  it('falls back to the shot intent where nothing is spoken at the chapter start', () => {
    const words = WORDS.filter((word) => word.t < 4).map((word) => ({
      ...word,
      t: word.t * 10,
      tEnd: word.tEnd * 10,
    }));
    const result = publishChapters({ shots: LONG, durationS: 305, meta: null, words });
    expect(result.chapters.map((chapter) => chapter.title).slice(0, 2)).toEqual([
      'Doom Runs',
      'A school calculator',
    ]);
  });

  it('uses Claude-suggested titles for the same second', () => {
    const meta: YoutubeMetaFile = {
      version: 1,
      source: 'claude',
      generatedAt: '2026-10-04T00:00:00.000Z',
      titles: ['a', 'b', 'c'],
      description: 'Why Doom runs everywhere.\n\n0:00 Intro\n0:49 The exam calculator\n9:59 Never',
      tags: ['doom'],
    };
    const result = publishChapters({ shots: LONG, durationS: 305, meta });
    expect(result.chapters.slice(0, 3).map((chapter) => chapter.title)).toEqual([
      'Intro',
      'The exam calculator',
      'Four megabytes needed',
    ]);
  });

  it('never titles a chapter with storyboard wording (real run Comic 2: "Story page")', () => {
    const intents = [
      'Hook: one splash page, a huge inked 1,000 M',
      'Story page, three beats, the last biggest',
      'The jellyfish glides in the dark',
    ];
    const shots = intents.map((intent, index) => shot(index, 12, { intent }));
    const narration = [
      'Below roughly one thousand meters, the sun gives up.',
      'First, the trick. A compound called luciferin reacts with oxygen.',
      'Why? Anglerfish dangle a lure.',
    ];
    const timed = (sentences: readonly string[]) =>
      sentences.flatMap((sentence, index) =>
        sentence.split(' ').map((text, offset) => ({
          text,
          t: index * 12 + offset * 0.3,
          tEnd: index * 12 + offset * 0.3 + 0.25,
        })),
      );
    const titles = (words: ReturnType<typeof timed>): string[] =>
      publishChapters({ shots, durationS: 36, meta: null, words }).chapters.map(
        (chapter) => chapter.title,
      );
    expect(titles(timed(narration))).toEqual(['One Thousand Meters', 'Trick', 'Anglerfish Dangle']);
    // Nothing spoken: intents without storyboard wording only.
    expect(titles([])).toEqual(['Intro', 'Part 2', 'The jellyfish glides']);
    expect(isStoryboardJargon('Story page')).toBe(true);
    expect(isStoryboardJargon('Closing card')).toBe(false);
    expect(isStoryboardJargon('Four megabytes needed')).toBe(false);
  });

  it('makes short human titles from intents', () => {
    expect(chapterTitle('Hook: what the viewer feels')).toBe('Hook');
    expect(chapterTitle('A school calculator on an exam bench; its screen glitches')).toBe(
      'A school calculator',
    );
    expect(chapterTitle('THE BIG REVEAL of the hack')).toBe('The big reveal');
    expect(chapterTitle('"61 KB" lands, counter rolls')).toBe('61 KB lands');
  });
});

const CREDITS = [
  'Credits',
  '',
  '- "Apollo launch" by NASA, Public Domain (https://www.nasa.gov/x), https://images.nasa.gov/a',
  '- "TI-84 photo" by someone, licence UNVERIFIED, https://example.org/ti [check licence]',
  '',
  'WARNING: 1 asset has an unverified licence ([check licence]); confirm the licence or replace it before publishing.',
  '',
].join('\n');

function input(overrides: Partial<PublishKitInput> = {}): PublishKitInput {
  return {
    title: 'Doom on a calculator',
    script: SCRIPT,
    shots: LONG,
    durationS: 305,
    meta: null,
    fallbackTags: ['doom on a calculator', 'calculator', 'doom', 'hackers'],
    credits: { markdown: CREDITS, count: 2, unverified: ['TI-84 photo'] },
    ...overrides,
  };
}

describe('buildPublishKit', () => {
  it('writes the four paste-ready texts (golden) with a visible warning for unverified assets', () => {
    const kit = buildPublishKit(input());
    const warning = [
      '!!! WARNING: 1 asset has an UNVERIFIED licence: "TI-84 photo".',
      '!!! Confirm its licence or replace it before publishing, then delete this block.',
    ].join('\n');
    expect(kit.files['description.txt']).toBe(
      [
        warning,
        '',
        'Doom runs on almost anything. Fridges, watches, even a printer.',
        '',
        'Chapters',
        '0:00 Doom runs on almost anything',
        '0:49 A school calculator',
        '1:53 Four megabytes needed',
        '2:54 The hero points',
        '3:46 Push into the calculator screen',
        '4:30 Closing card',
        '',
        'Links',
        '- (add your links here)',
        '',
        CREDITS.trim(),
        '',
        '#doomonacalculator #calculator #doom',
        '',
      ].join('\n'),
    );
    expect(kit.files['credits.txt']).toBe(`${warning}\n\n${CREDITS.trim()}\n`);
    expect(kit.files['tags.txt']).toBe('doom on a calculator, calculator, doom, hackers\n');
    expect(kit.files['chapters.txt']).toBe(
      kit.files['description.txt'].split('Chapters\n')[1]?.split('\n\n')[0]?.concat('\n'),
    );
    expect(kit.warnings).toEqual([
      '1 asset licence(s) unverified: confirm or replace before publishing.',
    ]);
    expect(kit.unverified).toEqual(['TI-84 photo']);
  });

  it('uses Claude’s description and tags, skips empty credits and missing chapters', () => {
    const meta: YoutubeMetaFile = {
      version: 1,
      source: 'claude',
      generatedAt: '2026-10-04T00:00:00.000Z',
      titles: ['a', 'b', 'c'],
      description: 'How a 1993 game fits in 61 KB.\n\n0:00 Old chapters\n0:11 Gone\n\n#doom #retro',
      tags: ['doom', 'ti-84', 'retro hacking'],
    };
    const kit = buildPublishKit(
      input({
        shots: EXAMPLE,
        durationS: 30.5,
        meta,
        credits: { markdown: 'Credits\n\n(no external assets used)\n', count: 0, unverified: [] },
      }),
    );
    expect(kit.files['description.txt']).toBe(
      'How a 1993 game fits in 61 KB.\n\nLinks\n- (add your links here)\n\n#doom #ti84 #retrohacking\n',
    );
    expect(kit.files['chapters.txt']).toBe(
      '(no chapters: no split at shot boundaries gives 3+ chapters of 10 s or more (video 30 s))\n',
    );
    expect(kit.chapterProblem).not.toBeNull();
    expect(kit.files['credits.txt']).toBe('Credits\n\n(no external assets used)\n');
    expect(kit.warnings).toEqual([]);
  });

  it('keeps the tags within YouTube’s 500 characters and warns about a long description', () => {
    const many = Array.from({ length: 60 }, (_, index) => `tag number ${String(index)} long`);
    expect(publishTags({ meta: null, fallbackTags: many }).join(',').length).toBeLessThanOrEqual(
      500,
    );
    const kit = buildPublishKit(input({ script: `${'Word '.repeat(1200)}end. Second.` }));
    expect(kit.warnings.at(-1)).toMatch(
      /^The description has \d+ characters \(YouTube allows 5000\)/,
    );
  });
});
