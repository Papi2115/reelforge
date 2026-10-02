import { describe, expect, it } from 'vitest';
import { peakColumns, peaksDuration } from './peak-columns.js';

const source = { peaks: Uint8Array.from([10, 200, 30, 40, 0, 0, 90, 5]), peaksPerSecond: 4 };

describe('peakColumns', () => {
  it('takes the loudest bucket per column when zoomed out', () => {
    expect([...peakColumns(source, 0, 1, 2)]).toEqual([200, 90]);
    expect([...peakColumns(source, 0.5, 1, 2)]).toEqual([40, 90]);
  });

  it('repeats buckets when a column is narrower than a bucket', () => {
    expect([...peakColumns(source, 0, 0.125, 4)]).toEqual([10, 10, 200, 200]);
  });

  it('leaves columns outside the audio silent', () => {
    expect([...peakColumns(source, 1.5, 0.5, 4)]).toEqual([90, 0, 0, 0]);
    expect([...peakColumns(source, -1, 0.5, 3)]).toEqual([0, 0, 200]);
    expect([...peakColumns({ peaks: new Uint8Array(), peaksPerSecond: 4 }, 0, 1, 2)]).toEqual([
      0, 0,
    ]);
  });

  it('knows how long the audio is', () => {
    expect(peaksDuration(source)).toBe(2);
  });
});
