import { describe, expect, it } from 'vitest';
import {
  noiseFloorFromWindows,
  parseLoudnormJson,
  parseMediaAudioInfo,
  parseRmsWindows,
  rmsWindowFilters,
} from './measure.js';

const LOUDNORM_STDERR = `Input #0, wav, from 'C:\\a b\\vo.wav':
  Duration: 00:00:42.50, bitrate: 768 kb/s
  Stream #0:0: Audio: pcm_s16le ([1][0][0][0] / 0x0001), 48000 Hz, mono, s16, 768 kb/s
Stream mapping:
  Stream #0:0 -> #0:0 (pcm_s16le (native) -> pcm_s16le (native))
[Parsed_loudnorm_0 @ 000001]
{
	"input_i" : "-30.91",
	"input_tp" : "-10.02",
	"input_lra" : "8.70",
	"input_thresh" : "-41.25",
	"output_i" : "-16.4",
	"output_tp" : "-1.50",
	"output_lra" : "6.00",
	"output_thresh" : "-27.0",
	"normalization_type" : "dynamic",
	"target_offset" : "0.4"
}
[out#0/null @ 000002] video:0KiB audio:3984KiB
`;

describe('parseLoudnormJson', () => {
  it('reads input I / TP / LRA from the last JSON block', () => {
    expect(parseLoudnormJson(LOUDNORM_STDERR)).toEqual({
      ok: true,
      value: { integratedLufs: -30.91, truePeakDbtp: -10.02, lraLu: 8.7 },
    });
  });

  it('maps -inf (silence) to -Infinity', () => {
    const stderr = '{ "input_i" : "-inf", "input_tp" : "-inf", "input_lra" : "0.00" }';
    const result = parseLoudnormJson(stderr);
    expect(result.ok && result.value.integratedLufs).toBe(Number.NEGATIVE_INFINITY);
  });

  it('fails with parse-failed when the block is absent or malformed', () => {
    expect(parseLoudnormJson('no json here')).toMatchObject({
      ok: false,
      error: { kind: 'parse-failed' },
    });
    expect(
      parseLoudnormJson('{ "input_i" : "abc", "input_tp": "1", "input_lra": "1" }'),
    ).toMatchObject({
      ok: false,
      error: { kind: 'parse-failed' },
    });
    expect(parseLoudnormJson('{ broken')).toMatchObject({ ok: false });
  });
});

describe('RMS windows and noise floor', () => {
  it('builds 50 ms windows at 48 kHz without padding the last frame', () => {
    expect(rmsWindowFilters(0.05, 48000)[0]).toBe('asetnsamples=n=2400:p=0');
  });

  it('parses ametadata lines including -inf', () => {
    const stdout = [
      'frame:0    pts:0       pts_time:0',
      'lavfi.astats.Overall.RMS_level=-41.250000',
      'frame:1    pts:2400    pts_time:0.05',
      'lavfi.astats.Overall.RMS_level=-inf',
      'lavfi.astats.Overall.RMS_level=-12.5',
    ].join('\r\n');
    expect(parseRmsWindows(stdout)).toEqual([-41.25, Number.NEGATIVE_INFINITY, -12.5]);
  });

  it('takes the 10th percentile, rounded and clamped to [-80, -20]', () => {
    const levels = [-10, -11, -12, -13, -14, -15, -16, -17, -18, -50, -51];
    expect(noiseFloorFromWindows(levels)).toBe(-50);
    expect(noiseFloorFromWindows([Number.NEGATIVE_INFINITY, -90])).toBe(-80);
    expect(noiseFloorFromWindows([-5, -6])).toBe(-20);
    expect(noiseFloorFromWindows([])).toBeNull();
  });
});

describe('parseMediaAudioInfo', () => {
  it('reads duration, rate and channels', () => {
    expect(parseMediaAudioInfo(LOUDNORM_STDERR)).toEqual({
      durationS: 42.5,
      sampleRate: 48000,
      channels: 1,
    });
  });

  it('handles stereo, explicit channel counts and missing info', () => {
    const stereo =
      '  Duration: 01:00:00.25, start\n  Stream #0:1(eng): Audio: aac (LC), 44100 Hz, stereo, fltp\n';
    expect(parseMediaAudioInfo(stereo)).toEqual({
      durationS: 3600.25,
      sampleRate: 44100,
      channels: 2,
    });
    const six = '  Stream #0:0: Audio: pcm_f32le, 96000 Hz, 6 channels, flt\n';
    expect(parseMediaAudioInfo(six)).toEqual({ durationS: null, sampleRate: 96000, channels: 6 });
    expect(parseMediaAudioInfo('')).toEqual({ durationS: null, sampleRate: null, channels: null });
  });
});
