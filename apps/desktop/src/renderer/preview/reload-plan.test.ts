import type { RenderManifest } from '@reelforge/shared';
import { describe, expect, it } from 'vitest';
import { affectsAudio, playbackAudioFile, playbackAudioUrl } from './audio-source.js';
import { planReload } from './reload-plan.js';

const BASE: RenderManifest = {
  version: 1,
  style: 'voxel-pixel-crisp640',
  fps: 30,
  seed: 1,
  shots: [
    { id: 's01', t0: 0, t1: 2, scene: { file: 'scenes/s01.js', source: 'one' } },
    {
      id: 's02',
      t0: 2,
      t1: 5,
      transitionIn: { type: 'crossfade', duration: 0.4 },
      scene: { file: 'scenes/s02.js', source: 'two' },
    },
  ],
};

function edit(change: (manifest: RenderManifest) => void): RenderManifest {
  const copy = structuredClone(BASE);
  change(copy);
  return copy;
}

describe('planReload', () => {
  it('needs a full load without a loaded video', () => {
    expect(planReload(undefined, BASE)).toEqual({ kind: 'full' });
  });

  it('does nothing when the video is unchanged', () => {
    expect(planReload(BASE, structuredClone(BASE))).toEqual({ kind: 'unchanged' });
  });

  it('rebuilds only the shots whose scene source changed', () => {
    const next = edit((manifest) => {
      const shot = manifest.shots[1];
      if (shot) shot.scene.source = 'two, edited';
    });
    expect(planReload(BASE, next)).toEqual({ kind: 'shots', shotIds: ['s02'] });
  });

  it('loads in full for any other change', () => {
    const changes: ((manifest: RenderManifest) => void)[] = [
      (manifest) => {
        if (manifest.shots[0]) manifest.shots[0].t1 = 2.5;
      },
      (manifest) => {
        if (manifest.shots[1]) manifest.shots[1].transitionIn = { type: 'cut' };
      },
      (manifest) => {
        if (manifest.shots[1]) manifest.shots[1].scene.file = 'scenes/s02b.js';
      },
      (manifest) => {
        manifest.seed = 2;
      },
      (manifest) => {
        manifest.shots.pop();
      },
      (manifest) => {
        manifest.words = { version: 1, words: [{ text: 'Hi', t: 0, tEnd: 0.2 }] };
      },
    ];
    for (const change of changes) expect(planReload(BASE, edit(change))).toEqual({ kind: 'full' });
  });
});

describe('playback audio', () => {
  it('prefers the mix, then the cleaned and the original voice-over', () => {
    const vo = ['audio/vo.original.m4a', 'project.json'];
    expect(playbackAudioFile(vo)).toBe('audio/vo.original.m4a');
    expect(playbackAudioFile([...vo, 'audio/vo.clean.wav'])).toBe('audio/vo.clean.wav');
    expect(playbackAudioFile([...vo, 'audio/vo.clean.wav', 'audio/mix.wav'])).toBe('audio/mix.wav');
    expect(playbackAudioFile(['audio/vo.original.txt', 'audio/sfx.wav'])).toBeUndefined();
  });

  it('builds a cache-busting media URL', () => {
    expect(playbackAudioUrl(['audio/mix.wav'], 3)).toBe(
      'reelforge-media://project/audio/mix.wav?v=3',
    );
    expect(playbackAudioUrl([], 3)).toBeUndefined();
  });

  it('notices audio changes', () => {
    expect(affectsAudio(['audio/mix.wav'], false)).toBe(true);
    expect(affectsAudio(['scenes/s01.js'], false)).toBe(false);
    expect(affectsAudio([], true)).toBe(true);
  });
});
