import { describe, expect, it } from 'vitest';
import { loadPrompt, renderPrompt } from '../catalog.js';
import { permissionStageFor, promptModel } from '../stages.js';
import { publishSeoPromptVars, validatePublishSeoReply } from './publish-seo.js';

const CANDIDATES = [
  { t: 0, narration: 'Every bridge moves a little.' },
  { t: 41.234, narration: 'In 1940 one moved far too much.' },
  { t: 95.5, narration: 'Engineers called it flutter.' },
  { t: 160, narration: 'The wind pushed at the right rhythm.' },
  { t: 230.75, narration: 'Within hours the deck twisted apart.' },
  { t: 300, narration: '' },
];
const INPUT = {
  title: 'Why the Bridge Collapsed',
  script: 'Every bridge moves a little. In 1940 one moved far too much.',
  beats: '1. Bridges move\n2. Flutter',
  research: '- Tacoma Narrows Bridge collapsed in 1940 — https://example.org/tacoma',
  durationS: 360.4,
  channel: {
    name: 'Voxplain',
    genreName: 'Science',
    genreDescription: 'Physics and nature, explained with experiments',
    style: 'voxel-pixel-crisp640',
    tags: ['science explained'],
    notes: 'Pop-science explainers.',
  },
  candidates: CANDIDATES,
};

const REPLY = {
  title: 'Why the Tacoma Narrows Bridge Collapsed',
  tags: {
    oneWord: ['bridge', 'engineering', 'physics', 'flutter', 'science'],
    twoWord: [
      'bridge collapse',
      'science explained',
      'tacoma narrows',
      'wind engineering',
      'physics explained',
    ],
    threeWord: [
      'tacoma narrows bridge',
      'why bridges fail',
      'how bridges work',
      'aeroelastic flutter explained',
      'engineering disasters explained',
    ],
  },
  chapters: [
    { t: 0, title: 'Why Every Bridge Moves' },
    { t: 41.23, title: 'The Bridge That Moved Too Much' },
    { t: 95.5, title: 'What Flutter Does to a Deck' },
    { t: 160, title: 'Wind at the Right Rhythm' },
    { t: 230.75, title: 'How the Deck Twisted Apart' },
  ],
};
const OPTIONS = { durationS: 360.4, candidates: CANDIDATES.map((candidate) => candidate.t) };

describe('publish-seo prompt', () => {
  it('is a Sonnet JSON turn under the read-only critic permissions', () => {
    expect(loadPrompt('publish-seo')).toMatchObject({
      version: 1,
      model: 'sonnet',
      output: { kind: 'json-reply' },
    });
    expect(permissionStageFor('publish-seo')).toBe('critic');
    expect(promptModel('publish-seo')).toBe('sonnet');
  });

  it('renders the channel, the capped texts and the candidate cuts', async () => {
    const rendered = renderPrompt('publish-seo', publishSeoPromptVars(INPUT));
    if (!rendered.ok) throw new Error(JSON.stringify(rendered.error));
    expect(rendered.value).toContain(
      '- genre: Science — Physics and nature, explained with experiments',
    );
    expect(rendered.value).toContain('41.23 (0:41) · In 1940 one moved far too much.');
    expect(rendered.value).toContain('300 (5:00) · (no narration)');
    expect(rendered.value).toContain('Between 5 and 6 chapters.');
    expect(rendered.value).not.toMatch(/\{\{[#^/]?\w+\}\}/);
    await expect(rendered.value).toMatchFileSnapshot('../fixtures/publish-seo.txt');
  });

  it('asks for no chapters when the video is too short, and fills in a missing channel', () => {
    const vars = publishSeoPromptVars({ ...INPUT, durationS: 25, channel: null, beats: '' });
    const rendered = renderPrompt('publish-seo', vars);
    expect(rendered.ok && rendered.value).toContain('return `"chapters":[]`');
    expect(rendered.ok && rendered.value).toContain('(no channel details');
    expect(rendered.ok && rendered.value).not.toContain('outline (beats)');
  });
});

describe('publish-seo reply', () => {
  it('accepts a reply that follows every rule', () => {
    const checked = validatePublishSeoReply(JSON.stringify(REPLY), OPTIONS);
    expect(checked.issues).toEqual([]);
    expect(checked.valid).toBe(true);
  });

  it('reports broken rules as errors (the stage repairs them)', () => {
    const bad = {
      ...REPLY,
      tags: {
        ...REPLY.tags,
        oneWord: ['bridge collapse', 'engineering', 'physics', 'Bridge', 'science'],
      },
      chapters: [
        { t: 0, title: 'Intro' },
        { t: 41.23, title: 'The Bridge That Moved Too Much' },
        { t: 47, title: 'What Flutter Does' },
        { t: 160, title: 'Wind at the Right Rhythm' },
      ],
    };
    const checked = validatePublishSeoReply(JSON.stringify(bad), OPTIONS);
    expect(checked.valid).toBe(false);
    expect(checked.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        'tag-words',
        'chapter-count',
        'chapter-generic',
        'chapter-gap',
        'chapter-candidate',
      ]),
    );
  });

  it('rejects malformed JSON and the wrong shape', () => {
    expect(validatePublishSeoReply('not json', OPTIONS).issues[0]?.code).toBe('invalid-json');
    const shape = validatePublishSeoReply(JSON.stringify({ tags: [], chapters: [] }), OPTIONS);
    expect(shape.value).toBeUndefined();
    expect(shape.issues[0]?.code).toBe('schema');
  });
});
