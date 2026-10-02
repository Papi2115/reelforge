import { describe, expect, it } from 'vitest';
import { encodeWav, wavHeader } from './wav.js';

describe('wavHeader', () => {
  it('writes a 44-byte PCM header', () => {
    const header = wavHeader(10, 2, 48_000, 'pcm16');
    expect(header.length).toBe(44);
    expect(header.toString('ascii', 0, 4)).toBe('RIFF');
    expect(header.readUInt32LE(4)).toBe(36 + 40);
    expect(header.toString('ascii', 8, 16)).toBe('WAVEfmt ');
    expect(header.readUInt32LE(16)).toBe(16);
    expect(header.readUInt16LE(20)).toBe(1);
    expect(header.readUInt16LE(22)).toBe(2);
    expect(header.readUInt32LE(24)).toBe(48_000);
    expect(header.readUInt32LE(28)).toBe(192_000);
    expect(header.readUInt16LE(32)).toBe(4);
    expect(header.readUInt16LE(34)).toBe(16);
    expect(header.toString('ascii', 36, 40)).toBe('data');
    expect(header.readUInt32LE(40)).toBe(40);
  });

  it('writes an IEEE float header with a fact chunk', () => {
    const header = wavHeader(10, 2, 48_000, 'float32');
    expect(header.length).toBe(58);
    expect(header.readUInt32LE(16)).toBe(18);
    expect(header.readUInt16LE(20)).toBe(3);
    expect(header.readUInt16LE(34)).toBe(32);
    expect(header.readUInt16LE(36)).toBe(0);
    expect(header.toString('ascii', 38, 42)).toBe('fact');
    expect(header.readUInt32LE(46)).toBe(10);
    expect(header.toString('ascii', 50, 54)).toBe('data');
    expect(header.readUInt32LE(54)).toBe(80);
    expect(header.readUInt32LE(4)).toBe(58 - 8 + 80);
  });
});

describe('encodeWav', () => {
  it('interleaves channels and clamps 16-bit samples', () => {
    const left = Float32Array.from([0.5, 2]);
    const right = Float32Array.from([-1, -0.25]);
    const bytes = encodeWav([left, right], 48_000, 'pcm16');
    const data = bytes.subarray(44);
    expect([0, 2, 4, 6].map((offset) => data.readInt16LE(offset))).toEqual([
      16_384, -32_767, 32_767, -8_192,
    ]);
  });

  it('stores float32 samples exactly', () => {
    const mono = Float32Array.from([0.1, -0.7, 1.5]);
    const data = encodeWav([mono], 44_100, 'float32').subarray(58);
    expect([0, 4, 8].map((offset) => data.readFloatLE(offset))).toEqual([...mono]);
  });
});
