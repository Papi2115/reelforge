import { describe, expect, it } from 'vitest';
import { clipFromRawF32, decodeArgs, decodedChannels } from './clip.js';

describe('decodedChannels', () => {
  it('reads the output stream format, not the input one', () => {
    const stderr = [
      "Input #0, wav, from 'in.wav':",
      '  Stream #0:0: Audio: pcm_s16le ([1][0][0][0] / 0x0001), 44100 Hz, 5.1, s16, 4233 kb/s',
      "Output #0, f32le, to 'out.f32':",
      '  Stream #0:0: Audio: pcm_f32le, 48000 Hz, stereo, flt, 3072 kb/s',
    ].join('\n');
    expect(decodedChannels(stderr)).toBe(2);
    expect(decodedChannels(stderr.replace('stereo, flt', 'mono, flt'))).toBe(1);
    expect(decodedChannels('no streams')).toBeNull();
    expect(decodedChannels(stderr.replace('48000 Hz, stereo', '44100 Hz, stereo'))).toBeNull();
  });
});

describe('clipFromRawF32', () => {
  it('splits interleaved stereo and shares mono samples', () => {
    const bytes = Buffer.alloc(16);
    [0.5, -0.5, 0.25, -0.25].forEach((value, index) => bytes.writeFloatLE(value, index * 4));
    const stereo = clipFromRawF32(bytes, 2);
    expect([...stereo.left]).toEqual([0.5, 0.25]);
    expect([...stereo.right]).toEqual([-0.5, -0.25]);
    const mono = clipFromRawF32(bytes, 1);
    expect(mono.left.length).toBe(4);
    expect(mono.right).toBe(mono.left);
  });
});

describe('decodeArgs', () => {
  it('resamples to 48 kHz float and keeps mono as mono', () => {
    const args = decodeArgs('C:\\a b\\ł.wav', 'C:\\w\\d.f32');
    expect(args.slice(0, 4)).toEqual(['-i', 'C:\\a b\\ł.wav', '-map', '0:a:0']);
    expect(args).toContain('aresample=48000,aformat=sample_fmts=flt:channel_layouts=mono|stereo');
    expect(args.at(-1)).toBe('C:\\w\\d.f32');
  });
});
