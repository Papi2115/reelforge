import { describe, expect, it } from 'vitest';
import { renderPrompt, loadPrompt } from '../catalog.js';
import { promptModel } from '../stages.js';
import { validateYoutubeMetaReply, withChapters } from './youtube-meta.js';

const CHAPTERS = '0:00 Intro\n0:12 Why it works\n0:24 Try it';
const good = {
  titles: ['One', 'Two', 'Three'],
  description: `What you learn.\n\n${CHAPTERS}`,
  tags: ['rainbow', 'light'],
};

describe('youtube-meta prompt and reply', () => {
  it('is a Sonnet JSON-reply prompt with optional chapters', () => {
    expect(loadPrompt('youtube-meta')).toMatchObject({
      model: 'sonnet',
      output: { kind: 'json-reply' },
    });
    expect(promptModel('youtube-meta', { economy: true })).not.toBe('sonnet-unknown');
    const without = renderPrompt('youtube-meta', { title: 'T', language: 'en', script: 'Hello.' });
    expect(without.ok && without.value).not.toContain('Chapters of the video');
    const rendered = renderPrompt('youtube-meta', {
      title: 'T',
      language: 'en',
      script: 'Hello.',
      chapters: CHAPTERS,
    });
    expect(rendered.ok && rendered.value).toContain('0:12 Why it works');
  });

  it('accepts a valid reply (also fenced) and checks the chapters are in the description', () => {
    expect(validateYoutubeMetaReply(JSON.stringify(good), { chapters: CHAPTERS }).valid).toBe(true);
    const fenced = validateYoutubeMetaReply(`\`\`\`json\n${JSON.stringify(good)}\n\`\`\``, {
      chapters: null,
    });
    expect(fenced.valid).toBe(true);
    const noChapters = validateYoutubeMetaReply(
      JSON.stringify({ ...good, description: 'Only text.' }),
      { chapters: CHAPTERS },
    );
    expect(noChapters.issues.map((entry) => entry.code)).toEqual(['chapters-missing']);
    // A warning only: the app appends the chapters itself.
    expect(noChapters.valid).toBe(true);
    expect(withChapters('Only text.', CHAPTERS)).toBe(`Only text.\n\n${CHAPTERS}`);
    expect(withChapters(good.description, CHAPTERS)).toBe(good.description);
    expect(withChapters('Only text.', null)).toBe('Only text.');
  });

  it('rejects two titles, equal titles, overlong tags and prose', () => {
    const codes = (value: unknown): string[] =>
      validateYoutubeMetaReply(JSON.stringify(value), { chapters: null }).issues.map(
        (entry) => entry.code,
      );
    expect(codes({ ...good, titles: ['A', 'B'] })).toContain('schema');
    expect(codes({ ...good, titles: ['Same', 'same', 'Other'] })).toEqual(['same-titles']);
    expect(codes({ ...good, tags: Array.from({ length: 30 }, () => 'x'.repeat(20)) })).toEqual([
      'tags-too-long',
    ]);
    expect(validateYoutubeMetaReply('Here are some titles!', { chapters: null }).valid).toBe(false);
  });
});
