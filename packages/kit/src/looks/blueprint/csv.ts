/**
 * Data entry of the blueprint charts: numbers pasted by the runtime Claude into the scene, as a
 * CSV/TSV string (header optional; first column = labels when there are several columns) or as
 * arrays. Special columns: `at`/`time` (seconds) and `say`/`phrase`/`anchor` (spoken phrase)
 * give every row its reveal time. Pure functions, unit-tested.
 */
import { KitError } from '../../errors.js';

export interface ChartSeries {
  readonly name: string;
  /** null = missing value (gap). */
  readonly values: readonly (number | null)[];
}

export interface ChartData {
  readonly labels: readonly string[];
  readonly series: readonly ChartSeries[];
  /** Per-row reveal times (seconds or phrases) from an `at`/`say` column. */
  readonly at?: readonly (number | string | undefined)[] | undefined;
}

const TIME_COLUMNS = new Set(['at', 'time', 't', 'seconds', 'sec']);
const PHRASE_COLUMNS = new Set(['say', 'phrase', 'anchor', 'when', 'word', 'words']);

/** Field separator: tab, semicolon or comma, whichever the first line uses most (outside quotes). */
export function detectSeparator(text: string): string {
  const first = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const unquoted = first.replace(/"[^"]*"/g, '');
  const count = (separator: string): number => unquoted.split(separator).length - 1;
  const ranked = ['\t', ';', ','].map((separator) => [separator, count(separator)] as const);
  const best = ranked.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : ',';
}

/** CSV rows: quoted fields ("a, b", "" = quote), trimmed cells, blank and # comment lines skipped. */
export function parseCsv(text: string, separator = detectSeparator(text)): string[][] {
  const rows: string[][] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim().length === 0 || raw.trim().startsWith('#')) continue;
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < raw.length; index += 1) {
      const char = raw[index] ?? '';
      if (quoted) {
        if (char === '"' && raw[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === separator) {
        cells.push(cell.trim());
        cell = '';
      } else cell += char;
    }
    cells.push(cell.trim());
    rows.push(cells);
  }
  return rows;
}

/**
 * A pasted number: optional currency ($ € £ ¥) and %, spaces/underscores/apostrophes as digit
 * groups, `1,234.5` and (with `decimalComma`) `1.234,5`. Empty, `-` or `n/a` = null; anything else
 * is undefined (not a number).
 */
export function parseNumber(cell: string, decimalComma = false): number | null | undefined {
  const trimmed = cell.trim();
  if (/^(|-|–|n\/?a|null|none)$/i.test(trimmed)) return null;
  let core = trimmed
    .replace(/^[+]/, '')
    .replace(/[$€£¥%]/g, '')
    .replace(/[\s_']/g, '');
  if (decimalComma) core = core.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(core)) core = core.replace(/,/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(core)) return undefined;
  const value = Number(core);
  return Number.isFinite(value) ? value : undefined;
}

function isNumeric(cell: string, decimalComma: boolean): boolean {
  return parseNumber(cell, decimalComma) !== undefined;
}

/** Turns CSV text into chart data (see the module doc for the rules). */
export function chartDataFromCsv(text: string): ChartData {
  const separator = detectSeparator(text);
  const rows = parseCsv(text, separator);
  if (rows.length === 0) throw new KitError('invalid-params', 'csv: no rows');
  const decimalComma =
    separator !== ',' && rows.some((row) => row.some((cell) => /^-?\d+,\d+$/.test(cell)));
  const width = Math.max(...rows.map((row) => row.length));
  const first = rows[0] ?? [];
  const second = rows[1];
  // A header row has a non-number where the next row has a number (or is the only text row).
  const header =
    rows.length > 1 &&
    first.some(
      (cell, index) =>
        !isNumeric(cell, decimalComma) &&
        second !== undefined &&
        isNumeric(second[index] ?? '', decimalComma),
    );
  const names = header ? first : [];
  const body = header ? rows.slice(1) : rows;
  const nameOf = (index: number): string => names[index] ?? '';
  const kind = (index: number): 'time' | 'phrase' | 'value' => {
    const name = nameOf(index).toLowerCase();
    if (TIME_COLUMNS.has(name)) return 'time';
    if (PHRASE_COLUMNS.has(name)) return 'phrase';
    return 'value';
  };
  const labelColumn = width > 1 ? 0 : -1;
  const valueColumns: number[] = [];
  for (let index = 0; index < width; index += 1) {
    if (index !== labelColumn && kind(index) === 'value') valueColumns.push(index);
  }
  if (valueColumns.length === 0) throw new KitError('invalid-params', 'csv: no column of numbers');
  const series = valueColumns.map((column) => ({
    name: nameOf(column),
    values: body.map((row, rowIndex) => {
      const cell = row[column] ?? '';
      const value = parseNumber(cell, decimalComma);
      if (value === undefined) {
        throw new KitError(
          'invalid-params',
          `csv: "${cell}" in row ${String(rowIndex + (header ? 2 : 1))}, column ${String(column + 1)} is not a number`,
        );
      }
      return value;
    }),
  }));
  const timeColumn = Array.from({ length: width }, (_, index) => index).find(
    (index) => kind(index) !== 'value',
  );
  const at =
    timeColumn === undefined
      ? undefined
      : body.map((row) => {
          const cell = row[timeColumn] ?? '';
          if (cell.length === 0) return undefined;
          if (kind(timeColumn) === 'phrase') return cell;
          const seconds = parseNumber(cell);
          return typeof seconds === 'number' ? seconds : cell;
        });
  return {
    labels: body.map((row, index) => (labelColumn === 0 ? (row[0] ?? '') : String(index + 1))),
    series,
    at,
  };
}

/** Chart data from arrays: one series of values, or several named series. */
export function chartDataFromArrays(input: {
  readonly values?: readonly number[] | undefined;
  readonly series?:
    readonly { readonly name: string; readonly values: readonly number[] }[] | undefined;
  readonly labels?: readonly string[] | undefined;
}): ChartData {
  const series: ChartSeries[] = input.series
    ? input.series.map((entry) => ({ name: entry.name, values: entry.values }))
    : [{ name: '', values: input.values ?? [] }];
  const count = Math.max(0, ...series.map((entry) => entry.values.length));
  if (count === 0) throw new KitError('invalid-params', 'chart: give csv, values or series');
  return {
    labels: Array.from({ length: count }, (_, index) => input.labels?.[index] ?? String(index + 1)),
    series,
  };
}
