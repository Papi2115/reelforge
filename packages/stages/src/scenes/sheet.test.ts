/**
 * Contact sheet rows of failed renders: a renderer that never started is labelled apart from a
 * render that timed out (beta feedback: "TIMED OUT" for a harness that did not start).
 */
import { describe, expect, it } from 'vitest';
import { renderTimeoutFinding } from './checks.js';
import { sheetFailure, sheetRow } from './sheet.js';

const failed = (extra: { timedOut?: boolean; notStarted?: boolean }) =>
  ({ ok: false, error: 'boom', errors: [], ...extra }) as const;

describe('failed render tiles', () => {
  it('labels a renderer that never started, a timeout and a scene that failed to load', () => {
    expect(sheetFailure(failed({ timedOut: true, notStarted: true }))).toBe('NOT STARTED');
    expect(sheetFailure(failed({ timedOut: true }))).toBe('TIMED OUT');
    expect(sheetFailure(failed({}))).toBe('FAILED TO LOAD');
    const row = sheetRow({
      shotId: 's03',
      times: [0.5, 2],
      render: failed({ timedOut: true, notStarted: true }),
    });
    expect(row.tiles.map((tile) => ('failure' in tile ? tile.failure : undefined))).toEqual([
      'NOT STARTED',
      'NOT STARTED',
    ]);
  });

  it('does not blame the scene when the renderer never started', () => {
    expect(renderTimeoutFinding({ error: 'no page', notStarted: true }).message).toBe(
      'the shot was not checked: no page. Look at it in the preview; the scene itself never ran.',
    );
    expect(renderTimeoutFinding({ error: 'stuck' }).message).toMatch(/loops forever/);
  });
});
