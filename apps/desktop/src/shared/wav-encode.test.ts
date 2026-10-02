import { describe, expect, it } from 'vitest';
import { encodeWav, levelOf, meterFill, mixToMono } from './wav-encode.js';

describe('wav encoding', () => {
  it('writes a canonical 48 kHz mono 16-bit PCM header', () => {
    const bytes = encodeWav(new Float32Array(48_000), 48_000);
    const view = new DataView(bytes.buffer);
    expect(bytes.byteLength).toBe(44 + 96_000);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.subarray(8, 16))).toBe('WAVEfmt ');
    expect([view.getUint16(20, true), view.getUint16(22, true)]).toEqual([1, 1]);
    expect(view.getUint32(24, true)).toBe(48_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(96_000);
  });

  it('clips and scales samples', () => {
    const view = new DataView(encodeWav(new Float32Array([2, -2, 0.5, 0]), 48_000).buffer);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([
      32767, -32768, 16383, 0,
    ]);
  });

  it('mixes channels to mono and measures levels', () => {
    expect([...mixToMono([new Float32Array([1, 0]), new Float32Array([0, 0.5])])]).toEqual([
      0.5, 0.25,
    ]);
    expect(mixToMono([])).toHaveLength(0);
    expect(levelOf(new Float32Array([0.5, -1]))).toEqual({ peak: 1, rms: Math.sqrt(0.625) });
    expect(meterFill(1)).toBe(1);
    expect(meterFill(0.001)).toBeCloseTo(0, 5);
    expect(meterFill(0)).toBe(0);
  });
});
