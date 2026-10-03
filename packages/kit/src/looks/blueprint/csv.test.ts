import { describe, expect, it } from 'vitest';
import {
  chartDataFromArrays,
  chartDataFromCsv,
  detectSeparator,
  parseCsv,
  parseNumber,
} from './csv.js';
import { decimalsOf, formatCompact, formatNumber, niceScale, niceStep } from './scale.js';

describe('CSV parsing', () => {
  it('detects the separator and parses quoted fields', () => {
    expect(detectSeparator('a,b,c')).toBe(',');
    expect(detectSeparator('a;b;c\n1;2;3')).toBe(';');
    expect(detectSeparator('a\tb')).toBe('\t');
    expect(detectSeparator('"x, y";z;w')).toBe(';');
    expect(parseCsv('name,value\n"Smith, J.",12\n"say ""hi""",3\n\n# note\n')).toEqual([
      ['name', 'value'],
      ['Smith, J.', '12'],
      ['say "hi"', '3'],
    ]);
  });

  it('reads pasted numbers', () => {
    expect(parseNumber('12')).toBe(12);
    expect(parseNumber(' -3.5 ')).toBe(-3.5);
    expect(parseNumber('$1,234.5')).toBe(1234.5);
    expect(parseNumber('45%')).toBe(45);
    expect(parseNumber('1 000 000')).toBe(1000000);
    expect(parseNumber('1.234,5', true)).toBe(1234.5);
    expect(parseNumber('n/a')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('twelve')).toBeUndefined();
  });

  it('turns a CSV with a header into labelled series and reveal phrases', () => {
    const data = chartDataFromCsv(
      'year,units,say\n1998,12,nineteen ninety eight\n2000,40,two thousand\n2005,,',
    );
    expect(data.labels).toEqual(['1998', '2000', '2005']);
    expect(data.series).toEqual([{ name: 'units', values: [12, 40, null] }]);
    expect(data.at).toEqual(['nineteen ninety eight', 'two thousand', undefined]);
  });

  it('reads headerless, multi-series, semicolon and timed CSVs', () => {
    expect(chartDataFromCsv('Doom,3\nCalculator,12')).toEqual({
      labels: ['Doom', 'Calculator'],
      series: [{ name: '', values: [3, 12] }],
      at: undefined,
    });
    const multi = chartDataFromCsv('day;pc;console;at\nMon;3,5;1;1.5\nTue;5;2;2');
    expect(multi.series.map((series) => series.name)).toEqual(['pc', 'console']);
    expect(multi.series[0]?.values).toEqual([3.5, 5]);
    expect(multi.at).toEqual([1.5, 2]);
    expect(chartDataFromCsv('5\n7\n9').series[0]?.values).toEqual([5, 7, 9]);
  });

  it('names the bad cell', () => {
    expect(() => chartDataFromCsv('year,units\n1998,12\n2000,lots')).toThrow(
      /"lots" in row 3, column 2 is not a number/,
    );
    expect(() => chartDataFromCsv('')).toThrow(/no rows/);
  });

  it('builds data from arrays', () => {
    expect(chartDataFromArrays({ values: [1, 2], labels: ['A'] }).labels).toEqual(['A', '2']);
    expect(
      chartDataFromArrays({
        series: [
          { name: 'a', values: [1] },
          { name: 'b', values: [1, 2, 3] },
        ],
      }).labels,
    ).toHaveLength(3);
    expect(() => chartDataFromArrays({})).toThrow(/give csv, values or series/);
  });
});

describe('axis maths', () => {
  it('picks nice steps and ranges', () => {
    expect(niceStep(95, 4)).toBe(25);
    expect(niceStep(12, 6)).toBe(2);
    expect(niceScale(0, 95)).toMatchObject({ min: 0, max: 100, ticks: [0, 25, 50, 75, 100] });
    expect(niceScale(3, 7, 4, { min: 0 }).min).toBe(0);
  });

  it('formats values', () => {
    expect(formatNumber(1250000, 0, '$')).toBe('$1,250,000');
    expect(formatNumber(-3.14159, 2, '', '%')).toBe('-3.14%');
    expect(formatCompact(1500)).toBe('1.5K');
    expect(formatCompact(2000000)).toBe('2M');
    expect(formatCompact(25)).toBe('25');
    expect(decimalsOf([1, 2.5, 3.25])).toBe(2);
  });
});
