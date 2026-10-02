import { describe, expect, it } from 'vitest';
import { computePipelineStatus, PIPELINE_STAGES } from './pipeline-status.js';

function statuses(files: readonly string[]): string[] {
  return computePipelineStatus(files).map((stage) => `${stage.id}:${stage.status}`);
}

describe('computePipelineStatus', () => {
  it('marks every stage of an empty project as waiting for the script', () => {
    const stages = computePipelineStatus(['project.json', 'CLAUDE.md', 'scenes/.keep']);
    expect(stages.map((stage) => stage.label)).toEqual(PIPELINE_STAGES.map((s) => s.label));
    expect(stages[0]).toMatchObject({ status: 'ready', waitingFor: undefined });
    expect(stages.slice(1).every((stage) => stage.status === 'waiting')).toBe(true);
    expect(stages[7]?.waitingFor).toBe('Script written');
  });

  it('recognises each stage output', () => {
    expect(
      statuses([
        'script.txt',
        'audio/vo.original.m4a',
        'audio/vo.clean.wav',
        'timing/words.json',
        'storyboard.json',
        'scenes/s01_intro.js',
        'audio/mix.wav',
        'out/Doom on a calculator.mp4',
      ]),
    ).toEqual([
      'script:done',
      'voiceover:done',
      'audio-clean:done',
      'words:done',
      'storyboard:done',
      'scenes:done',
      'sound:done',
      'export:done',
    ]);
  });

  it('makes the first unfinished stage ready and later ones wait for it', () => {
    const stages = computePipelineStatus([
      'script.txt',
      'timing/words.json',
      'storyboard.json',
      'scenes/s01_title.js',
    ]);
    expect(stages.map((stage) => stage.status)).toEqual([
      'done',
      'ready',
      'waiting',
      'done',
      'done',
      'done',
      'waiting',
      'waiting',
    ]);
    expect(stages[2]?.waitingFor).toBe('Voiceover added');
  });

  it('ignores look-alikes in other folders and wrong extensions', () => {
    expect(
      statuses([
        'old/script.txt',
        'audio/vo.original',
        'scenes/notes.md',
        'scenes/nested/s01.js',
        'out/video.mov',
      ]).filter((entry) => entry.endsWith(':done')),
    ).toEqual([]);
    expect(statuses(['SCRIPT.TXT'])[0]).toBe('script:done');
  });
});
