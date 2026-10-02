/** Sync check (PLAN.md#7.7): events vs spoken words, ±150 ms. */
import type { ResolvedAnchor } from '@reelforge/engine';
import { AnchorIndex } from '@reelforge/pipeline';
import { describe, expect, it } from 'vitest';
import { shotSync, shotSyncEvents, syncFindings } from './sync.js';

const shot = { id: 's02', t0: 2, t1: 6 };
const words = new AnchorIndex([
  { text: 'Doom', t: 0.3, tEnd: 0.6 },
  { text: 'runs', t: 2.4, tEnd: 2.7 },
  { text: 'on', t: 2.7, tEnd: 2.8 },
  { text: '61', t: 3.0, tEnd: 3.3 },
  { text: 'KB', t: 3.3, tEnd: 3.6 },
  { text: 'later', t: 6.5, tEnd: 6.9 },
]);

function anchor(phrase: string, t: number): ResolvedAnchor {
  return { shotId: 's02', phrase, nth: 1, t, tEnd: t + 0.3 };
}

describe('shotSyncEvents', () => {
  it('measures anchors and cues against the spoken words', () => {
    const events = shotSyncEvents({
      shot,
      anchors: [anchor('61 KB', 3.0), anchor('later', 6.5), { ...anchor('x', 1), shotId: 's01' }],
      sceneCues: [
        { t: 3.1, name: 'hit' },
        { t: 3.4, name: 'whoosh' },
        { t: 5.0, name: 'click' },
      ],
      projectCues: [{ t: 2.95, name: 'pop' }],
      words,
    });
    expect(events.map((event) => [event.kind, event.label, event.deltaMs, event.verdict])).toEqual([
      ['cue', 'pop', -50, 'ok'],
      ['anchor', '61 KB', 0, 'ok'],
      ['sfx', 'hit', 100, 'ok'],
      ['sfx', 'whoosh', 400, 'off'],
      ['sfx', 'click', null, 'free'],
      ['anchor', 'later', 0, 'outside-shot'],
    ]);
    const summary = shotSync(shot, events);
    expect(summary).toMatchObject({ problems: 2, maxDeltaMs: 400 });
    const findings = syncFindings(events, shot);
    expect(findings.map((entry) => entry.message)).toEqual([
      'sfx "whoosh" at 3.40 s (local 1.40 s) misses "61 KB" (spoken 3.00 s) by 400 ms (allowed ±150 ms); schedule it at the anchor time: sfx.at(hit.t, …)',
      'anchor "later" at 6.50 s (local 4.50 s) is outside the shot (2.00–6.00 s); anchor a phrase spoken during the shot and keep cues inside it',
    ]);
  });

  it('flags an anchor the words file puts elsewhere', () => {
    const [event] = shotSyncEvents({
      shot,
      anchors: [anchor('runs on', 2.9)],
      sceneCues: [],
      words,
    });
    expect(event).toMatchObject({ spokenT: 2.4, deltaMs: 500, verdict: 'off' });
  });

  it('keeps the exact boundary of ±150 ms', () => {
    const events = shotSyncEvents({
      shot,
      anchors: [anchor('61 KB', 3.0)],
      sceneCues: [
        { t: 3.15, name: 'edge' },
        { t: 2.84, name: 'early' },
      ],
    });
    expect(events.map((event) => event.verdict)).toEqual(['off', 'ok', 'ok']);
  });
});
