import { describe, expect, it } from 'vitest';
import { ProgressParser, parseClockTime } from './progress.js';

const BLOCK_START = `frame=0
fps=0.00
out_time_us=N/A
out_time_ms=N/A
out_time=N/A
total_size=N/A
speed=N/A
progress=continue
`;

const BLOCK_MID = `frame=48
fps=24.00
total_size=1024
out_time_us=2000000
out_time_ms=2000000
out_time=00:00:02.000000
speed=1.5x
progress=continue
`;

const BLOCK_END = `out_time_us=4000000
out_time=00:00:04.000000
speed=1.05e+03x
progress=end
`;

describe('ProgressParser', () => {
  it('emits one progress per block and handles N/A', () => {
    const parser = new ProgressParser(4);
    const [start] = parser.push(BLOCK_START);
    expect(start).toEqual({
      outTimeS: null,
      frame: 0,
      fps: 0,
      speed: null,
      totalSizeBytes: null,
      ratio: null,
      done: false,
    });
  });

  it('reassembles lines split across chunks (CRLF too)', () => {
    const parser = new ProgressParser(4);
    const text = BLOCK_MID.replace(/\n/g, '\r\n');
    const first = parser.push(text.slice(0, 37));
    const second = parser.push(text.slice(37));
    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      outTimeS: 2,
      frame: 48,
      speed: 1.5,
      ratio: 0.5,
      done: false,
    });
  });

  it('marks the end block as done with ratio 1', () => {
    const parser = new ProgressParser(null);
    const [end] = parser.push(BLOCK_END);
    expect(end).toMatchObject({ outTimeS: 4, speed: 1050, ratio: 1, done: true });
  });

  it('falls back to out_time when microsecond fields are missing and clamps ratio', () => {
    const parser = new ProgressParser(2);
    const [progress] = parser.push('out_time=00:00:03.500000\nprogress=continue\n');
    expect(progress).toMatchObject({ outTimeS: 3.5, ratio: 1 });
  });

  it('clamps negative start times to zero', () => {
    const parser = new ProgressParser(10);
    const [progress] = parser.push('out_time_us=-23220\nprogress=continue\n');
    expect(progress?.outTimeS).toBe(0);
  });
});

describe('parseClockTime', () => {
  it('parses HH:MM:SS.micro', () => {
    expect(parseClockTime('01:02:03.500000')).toBe(3723.5);
    expect(parseClockTime('-00:00:00.023220')).toBeCloseTo(-0.02322);
    expect(parseClockTime('N/A')).toBeNull();
    expect(parseClockTime(undefined)).toBeNull();
  });
});
