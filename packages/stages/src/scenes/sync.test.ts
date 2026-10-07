/** Sync check (PLAN.md#7.7): events vs spoken words, ±150 ms. */
import type { CardDiagnostic, ResolvedAnchor } from '@reelforge/engine';
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

  it('times annotations with a phrase from the card QA records (local -> global)', () => {
    const record = (id: string, at: number, rule: CardDiagnostic['rule']): CardDiagnostic => ({
      rule,
      severity: rule === 'annotation-anchor' ? 'info' : 'warning',
      shotId: 's02',
      cards: [id],
      t0: at,
      t1: at,
      message: '',
      fix: '',
      anchor: { phrase: '61 KB', at, spokenT: 1 },
    });
    const events = shotSyncEvents({
      shot,
      anchors: [],
      sceneCues: [],
      cards: [
        record('ring', 1.1, 'annotation-anchor'),
        record('late', 1.5, 'annotation-off-anchor'),
        { ...record('plain', 0, 'card-overlap'), anchor: undefined },
      ],
    });
    expect(
      events.map((event) => [event.kind, event.label, event.t, event.deltaMs, event.verdict]),
    ).toEqual([
      ['annotation', 'ring', 3.1, 100, 'ok'],
      ['annotation', 'late', 3.5, 500, 'off'],
    ]);
    expect(shotSync(shot, events).problems).toBe(1);
    // Reported by the card QA already (annotation-off-anchor): not a second sync finding.
    expect(syncFindings(events, shot)).toEqual([]);
  });
});

describe('anchors spoken again inside the shot (real run Comic 1)', () => {
  it('measures an anchor against the occurrence in the shot, not the film first', () => {
    const repeated = new AnchorIndex([
      { text: 'in', t: 0.61, tEnd: 0.7 },
      { text: 'was', t: 33.0, tEnd: 33.2 },
      { text: 'in', t: 33.2, tEnd: 33.35 },
    ]);
    const s08 = { id: 's08', t0: 32.47, t1: 36.23 };
    const [event] = shotSyncEvents({
      shot: s08,
      anchors: [{ shotId: 's08', phrase: 'in', nth: 1, t: 33.2, tEnd: 33.35 }],
      sceneCues: [],
      words: repeated,
    });
    expect(event).toMatchObject({ kind: 'anchor', spokenT: 33.2, deltaMs: 0, verdict: 'ok' });
  });
});

describe('kit cues (real runs Game B1 1 #10, Game B1 2 #7)', () => {
  const kitScene = `export function build(ctx) {
  const { sfx } = ctx;
  const hit = ctx.anchor('61 KB');
  const r = ctx.kit.worlds.gameB1.screen(ctx).scoreTable({ at: hit.t });
  for (const c of r.cues) if (c.name !== 'glitch') sfx.at(c.t, c.name);
  sfx.at(hit.t + 0.4, 'whoosh');
  sfx.at(hit.t, 'tick');
  return {};
}`;
  const cues = [
    { t: 3.0, name: 'tick' },
    { t: 3.3, name: 'tick' },
    { t: 3.35, name: 'blip' },
    { t: 3.4, name: 'whoosh' },
    { t: 6.4, name: 'blip' },
  ];
  const verdicts = (source: string | undefined) =>
    shotSyncEvents({ shot, anchors: [anchor('61 KB', 3.0)], sceneCues: cues, words, source }).map(
      (event) => `${event.label} ${event.verdict}`,
    );

  it("frees the kit's cues near a word; the scene's own cues and cues outside the shot stay checked", () => {
    expect(verdicts(kitScene)).toEqual([
      '61 KB ok',
      'tick ok',
      'tick free',
      'blip free',
      'whoosh off',
      'blip outside-shot',
    ]);
  });

  it('checks every cue without kit loops, with a computed name or with an unreadable source', () => {
    const before = [
      '61 KB ok',
      'tick ok',
      'tick off',
      'blip off',
      'whoosh off',
      'blip outside-shot',
    ];
    expect(verdicts(undefined)).toEqual(before);
    expect(verdicts(kitScene.replace(/for \(const c of r\.cues\).*\n/, ''))).toEqual(before);
    expect(verdicts(kitScene.replace("'whoosh'", 'name'))).toEqual(before);
    expect(verdicts('export function build( {')).toEqual(before);
  });

  it('keeps every cue of a name the scene schedules in its own loop checked', () => {
    const looped = kitScene.replace(
      "sfx.at(hit.t, 'tick');",
      "for (const t of [hit.t]) sfx.at(t, 'tick');",
    );
    expect(verdicts(looped)).toContain('tick off');
  });
});
