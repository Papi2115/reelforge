import { describe, expect, it } from 'vitest';
import type { PublishKitView } from '../../shared/publish-contract.js';
import {
  chaptersNote,
  kitSummary,
  previewRows,
  PUBLISH_FILE_LABELS,
  saveNote,
  unverifiedBanner,
} from './publish-view.js';

function kit(overrides: Partial<PublishKitView> = {}): PublishKitView {
  return {
    files: [
      { name: 'description.txt', text: 'Hook.\n\nChapters\n0:00 A\n' },
      { name: 'chapters.txt', text: '0:00 A\n0:11 B\n0:22 C\n' },
      { name: 'tags.txt', text: 'doom, calculator\n' },
      { name: 'credits.txt', text: 'Credits\n\n(no external assets used)\n' },
    ],
    chapterCount: 3,
    chapterProblem: null,
    unverified: [],
    warnings: [],
    metaSource: 'claude',
    creditedAssets: 0,
    ...overrides,
  };
}

describe('publish kit view', () => {
  it('labels the four files', () => {
    expect(Object.values(PUBLISH_FILE_LABELS)).toEqual([
      'Description',
      'Chapters',
      'Tags',
      'Credits',
    ]);
  });

  it('warns about unverified licences, singular and plural', () => {
    expect(unverifiedBanner(kit())).toBeNull();
    expect(unverifiedBanner(kit({ unverified: ['TI-84 photo'] }))).toBe(
      '⚠ 1 asset has an unverified licence ("TI-84 photo"). The description and credits carry a WARNING block: confirm the licence or replace the asset before publishing.',
    );
    expect(unverifiedBanner(kit({ unverified: ['A', 'B'] }))).toMatch(
      /^⚠ 2 assets have an unverified licence \("A", "B"\)\..*confirm each licence or replace them/,
    );
  });

  it('summarises chapters, the text source and the credits', () => {
    expect(kitSummary(kit())).toBe(
      '3 chapters · description and tags by Claude · no external assets',
    );
    expect(
      kitSummary(
        kit({
          chapterProblem: 'too short',
          chapterCount: 0,
          metaSource: 'none',
          creditedAssets: 1,
        }),
      ),
    ).toBe('no chapters · description from the script · 1 asset credited');
    expect(kitSummary(kit({ metaSource: 'template', creditedAssets: 2 }))).toContain(
      'from the template · 2 assets',
    );
    expect(chaptersNote(kit())).toBeNull();
    expect(chaptersNote(kit({ chapterProblem: 'the video is too short' }))).toBe(
      'Chapters skipped: the video is too short.',
    );
    expect(
      chaptersNote(
        kit({
          chapterProblem:
            'YouTube needs at least 3 chapters of 10 s or more; the video is too short or has too few shots',
        }),
      ),
    ).toBe(
      'Chapters skipped: needs 3 chapters of 10 s (the film is too short or has too few shots).',
    );
  });

  it('describes the outcome of Save and sizes the previews', () => {
    expect(saveNote({ status: 'saved', files: ['a', 'b', 'c', 'd'], committed: true })).toBe(
      '4 files saved to publish/ and committed.',
    );
    expect(saveNote({ status: 'saved', files: ['a'], committed: false })).toBe(
      '1 file saved to publish/ (not committed: see the log).',
    );
    expect(saveNote({ status: 'error', message: 'disk full' })).toBe('Not saved: disk full');
    expect(previewRows('one\n')).toBe(2);
    expect(previewRows('a\nb\nc\nd\n')).toBe(4);
    expect(previewRows('x\n'.repeat(40))).toBe(12);
  });
});
