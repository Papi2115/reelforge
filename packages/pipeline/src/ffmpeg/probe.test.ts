import { describe, expect, it } from 'vitest';
import { capabilitiesOf, parseEncoders, parseFilters, parseVersionOutput } from './probe.js';

const GPL_VERSION = `ffmpeg version 8.1.1-full_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers
built with gcc 15.2.0 (Rev13, Built by MSYS2 project)
configuration: --enable-gpl --enable-version3 --enable-static --enable-libx264 --enable-whisper
libavutil      60. 26.101 / 60. 26.101
`;

const LGPL_VERSION = `ffmpeg version n7.1-lgpl Copyright (c) 2000-2024 the FFmpeg developers
  configuration: --prefix=/ffbuild/prefix --enable-version3 --disable-debug
`;

const ENCODERS = `Encoders:
 V..... = Video
 A..... = Audio
 ------
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC (codec h264)
 V....D h264_amf             AMD AMF H.264 Encoder (codec h264)
 V....D h264_nvenc           NVIDIA NVENC H.264 encoder (codec h264)
 V..... h264_qsv             H.264 (Intel Quick Sync Video acceleration) (codec h264)
 A....D aac                  AAC (Advanced Audio Coding)
`;

const FILTERS_V8 = `Filters:
  T.. = Timeline support
  ------
 TS afftdn            A->A       Denoise audio samples using FFT.
 T. alimiter          A->A       Audio lookahead limiter.
 .. loudnorm          A->A       EBU R128 loudness normalization
 .. amovie            |->N       Read audio from a movie source.
 .. ebur128           A->N       EBU R128 scanner.
`;

const FILTERS_OLD = ` T.C highpass          A->A       Apply a high-pass filter.
 ... anullsrc          |->A       Null audio source.
`;

describe('parseVersionOutput', () => {
  it('reads version, GPL licence and whisper flag', () => {
    const info = parseVersionOutput(GPL_VERSION);
    expect(info).toMatchObject({
      version: '8.1.1-full_build-www.gyan.dev',
      license: 'GPL',
      version3: true,
      hasWhisper: true,
    });
  });

  it('detects LGPL builds', () => {
    expect(parseVersionOutput(LGPL_VERSION)).toMatchObject({
      version: 'n7.1-lgpl',
      license: 'LGPL',
      hasWhisper: false,
    });
  });

  it('detects nonfree builds', () => {
    const text = 'ffmpeg version 6.0\nconfiguration: --enable-gpl --enable-nonfree\n';
    expect(parseVersionOutput(text)?.license).toBe('nonfree');
  });

  it('returns null for non-ffmpeg output', () => {
    expect(parseVersionOutput('something else')).toBeNull();
  });
});

describe('parseEncoders / parseFilters / capabilitiesOf', () => {
  it('lists encoder names without the legend', () => {
    const encoders = parseEncoders(ENCODERS);
    expect([...encoders].sort()).toEqual(['aac', 'h264_amf', 'h264_nvenc', 'h264_qsv', 'libx264']);
  });

  it('lists filters for 2- and 3-column flag formats', () => {
    expect([...parseFilters(FILTERS_V8)]).toEqual([
      'afftdn',
      'alimiter',
      'loudnorm',
      'amovie',
      'ebur128',
    ]);
    expect([...parseFilters(FILTERS_OLD)]).toEqual(['highpass', 'anullsrc']);
  });

  it('summarises capabilities', () => {
    const caps = capabilitiesOf(parseEncoders(ENCODERS), parseFilters(FILTERS_V8));
    expect(caps.libx264).toBe(true);
    expect(caps.hardwareH264).toEqual(['nvenc', 'qsv', 'amf']);
    expect(caps.filters).toEqual({
      highpass: false,
      afftdn: true,
      arnndn: false,
      loudnorm: true,
      alimiter: true,
      silenceremove: false,
    });
  });
});
