import { describe, expect, it } from 'vitest';
import { DuckingSchema } from './cues.js';
import {
  SIDECHAIN_TAIL_FRAMES,
  duckingFilter,
  premixArgs,
  premixGraph,
  stemArgs,
  type PremixInputs,
} from './graph.js';

const ducking = DuckingSchema.parse({});

const inputs = (musicBuses: PremixInputs['musicBuses']): PremixInputs => ({
  voPath: 'C:\\proj ł\\vo.clean.wav',
  sfxBusPath: 'w/sfx.wav',
  ambienceBusPath: 'w/amb.wav',
  musicBuses,
  totalFrames: 2_880_000,
  voGainDb: -1.5,
});

describe('duckingFilter', () => {
  it('maps dB/ms settings onto sidechaincompress options', () => {
    expect(duckingFilter(ducking)).toBe(
      'sidechaincompress=threshold=0.031623:ratio=8:attack=20:release=400:makeup=1:detection=rms:link=average',
    );
    expect(duckingFilter({ ...ducking, thresholdDb: -60 })).toContain('threshold=0.001000');
  });
});

describe('premixGraph', () => {
  it('ducks a single music bus by the VO (padded past the end, then trimmed) and sums four buses', () => {
    expect(SIDECHAIN_TAIL_FRAMES).toBe(48_000);
    expect(premixGraph(inputs([{ path: 'm0.wav', ducking }])).split(';')).toEqual([
      '[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono,pan=stereo|c0=c0|c1=c0,' +
        'volume=-1.50dB,apad=whole_len=2928000,atrim=end_sample=2928000,' +
        'asplit=3[vo_mix_full][vo_stem_full][vo_sc0]',
      '[vo_mix_full]atrim=end_sample=2880000[vo_mix]',
      '[vo_stem_full]atrim=end_sample=2880000[vo_stem]',
      '[3:a]apad=whole_len=2928000[mp0]',
      `[mp0][vo_sc0]${duckingFilter(ducking)},atrim=end_sample=2880000[m0]`,
      '[m0]asplit=2[music_mix][music_stem]',
      '[vo_mix][1:a][2:a][music_mix]amix=inputs=4:normalize=0:duration=longest[premix]',
    ]);
  });

  it('gives each ducked bus its own sidechain and passes unducked buses through', () => {
    const graph = premixGraph(
      inputs([
        { path: 'm0.wav', ducking: null },
        { path: 'm1.wav', ducking },
        { path: 'm2.wav', ducking: { ...ducking, ratio: 3 } },
      ]),
    );
    expect(graph).toContain('asplit=4[vo_mix_full][vo_stem_full][vo_sc0][vo_sc1]');
    expect(graph).toContain('[3:a]anull[m0]');
    expect(graph).toContain('[mp1][vo_sc0]sidechaincompress=');
    expect(graph).toContain('[mp2][vo_sc1]sidechaincompress=threshold=0.031623:ratio=3');
    expect(graph).toContain(
      '[m0][m1][m2]amix=inputs=3:normalize=0:duration=longest,asplit=2[music_mix][music_stem]',
    );
  });
});

describe('premixArgs / stemArgs', () => {
  it('passes paths as separate argv entries and writes bit-exact float WAVs', () => {
    const args = premixArgs(inputs([{ path: 'm0.wav', ducking }]), {
      premix: 'w/premix.wav',
      voStem: 'w/vo.wav',
      musicStem: 'w/music.wav',
    });
    expect(args.slice(0, 9)).toEqual([
      '-y',
      '-i',
      'C:\\proj ł\\vo.clean.wav',
      '-i',
      'w/sfx.wav',
      '-i',
      'w/amb.wav',
      '-i',
      'm0.wav',
    ]);
    expect(args.filter((arg) => arg === '+bitexact')).toHaveLength(3);
    expect(args.filter((arg) => arg === 'pcm_f32le')).toHaveLength(3);
    expect(args.at(-1)).toBe('w/music.wav');
  });

  it('applies one gain to every stem', () => {
    const args = stemArgs(
      [
        { input: 'a.wav', output: 'A.wav' },
        { input: 'b.wav', output: 'B.wav' },
      ],
      2.345,
    );
    expect(args).toContain('[0:a]volume=2.35dB[s0];[1:a]volume=2.35dB[s1]');
    expect(args.filter((arg) => arg === '-map')).toHaveLength(2);
    expect(args.at(-1)).toBe('B.wav');
  });
});
