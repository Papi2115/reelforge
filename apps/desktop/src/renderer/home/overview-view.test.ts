import { SHORTS_UNSUPPORTED_MESSAGE } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import type { OverviewThumbnail, ProjectOverview } from '../../shared/overview-contract.js';
import { card, steps } from './home-test-cards.js';
import {
  formatBytes,
  needsYouLines,
  nextStepAction,
  scenesFact,
  shortsButton,
  stepPanel,
  thumbnailFacts,
  thumbnailNotes,
} from './overview-view.js';

function thumbnail(width: number, height: number, bytes: number): OverviewThumbnail {
  return { fileName: 'thumbnail.png', picture: 'data:', width, height, bytes };
}

function overview(extra: Partial<ProjectOverview> = {}): ProjectOverview {
  return {
    card: card('Film', { hasScript: true }),
    thumbnail: null,
    facts: { voice: 'none', shots: 0, scenesBuilt: 0, exportFile: null, exportedAt: null },
    shorts: [],
    shortsSupported: true,
    parent: null,
    ...extra,
  };
}

describe('thumbnail notes', () => {
  it('says nothing about a 1280×720 picture under 2 MB', () => {
    expect(thumbnailNotes(thumbnail(1280, 720, 900_000))).toEqual([]);
    expect(thumbnailFacts(thumbnail(1280, 720, 900_000))).toBe('1280 × 720 · 879 KB · PNG');
  });

  it('notes a file over 2 MB and a picture that is not 16:9', () => {
    const notes = thumbnailNotes(thumbnail(1000, 1000, 3 * 1024 * 1024));
    expect(notes).toEqual([
      'YouTube takes thumbnails up to 2 MB; this one is 3.0 MB. Save it as a JPEG or smaller.',
      'This picture is 1000 × 1000, not 16:9: YouTube adds bars or crops it. 1280 × 720 fits best.',
    ]);
  });

  it('notes a 16:9 picture that is too small or another size', () => {
    expect(thumbnailNotes(thumbnail(480, 270, 1000))).toEqual([
      'This picture is 480 × 270: YouTube wants at least 640 wide. 1280 × 720 fits best.',
    ]);
    expect(thumbnailNotes(thumbnail(1920, 1080, 1000))).toEqual([
      'This picture is 1920 × 1080; YouTube recommends 1280 × 720 (it is scaled to fit).',
    ]);
  });

  it('formats sizes', () => {
    expect(formatBytes(10)).toBe('1 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });
});

describe('next step and needs you', () => {
  it('opens the brief before a script exists, the script after', () => {
    expect(stepPanel('script', false)).toBe('brief');
    expect(stepPanel('script', true)).toBe('script');
    expect(stepPanel('clean', true)).toBe('voiceover');
    expect(stepPanel('scenes', true)).toBe('scenes');
    expect(stepPanel('export', true)).toBe('project');
  });

  it('points at the first step that waits', () => {
    const film = card('Film', {
      hasScript: true,
      steps: steps({ script: 'done', voice: 'needs-you', words: 'problem' }),
    });
    expect(nextStepAction(film)).toEqual({
      step: 'voice',
      label: 'Open Voice',
      panel: 'voiceover',
    });
    expect(needsYouLines(film)).toEqual([
      { step: 'voice', text: 'Add the voice: record, import or generate it.' },
      { step: 'words', text: 'Words stopped with a problem: open it to see why.' },
    ]);
  });

  it('has no next step when everything is done', () => {
    const done = card('Done', {
      steps: steps({
        script: 'done',
        voice: 'done',
        clean: 'done',
        words: 'done',
        storyboard: 'done',
        scenes: 'done',
        sound: 'done',
        export: 'done',
      }),
    });
    expect(nextStepAction(done)).toBeNull();
    expect(needsYouLines(done)).toEqual([]);
  });

  it('asks for the brief or the approval of the script', () => {
    const fresh = card('New', { steps: steps({ script: 'needs-you' }) });
    expect(needsYouLines(fresh)[0]?.text).toBe('Describe the video, then write the script.');
    expect(needsYouLines({ ...fresh, hasScript: true })[0]?.text).toBe(
      'Read and approve the script.',
    );
  });
});

describe('facts and Shorts', () => {
  it('describes the scenes', () => {
    expect(scenesFact(overview().facts)).toBe('No storyboard yet');
    expect(scenesFact({ ...overview().facts, shots: 14, scenesBuilt: 1 })).toBe(
      '14 shots · 1 scene built',
    );
  });

  it('waits for a supported style and a script', () => {
    expect(shortsButton(overview())).toEqual({ enabled: true, reason: null });
    expect(shortsButton(overview({ shortsSupported: false }))).toEqual({
      enabled: false,
      reason: SHORTS_UNSUPPORTED_MESSAGE,
    });
    expect(shortsButton(overview({ card: card('Film') }))).toEqual({
      enabled: false,
      reason: 'Needs a script first: Shorts are written from it.',
    });
  });
});
