/**
 * Grim Ink acting vocabulary (PLAN.md#14.20): two-body gags solved in world space with the rig's
 * contact helpers — the hands that should meet meet (handshake, hand-on, push, the catch), the
 * thing travels from one person to the other (hand-over, drop-and-catch), the clink hits on its
 * beat, the deeper bow is deeper, the target turns round on the ring, the head shake cycles; every
 * gag holds still before t0, is a pure function of its options, and accepts a person handle or its
 * character record.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { palmWorld, type Point2 } from '../draw/contact.js';
import { personFromModule, type InkPerson } from '../modules/person.js';
import { VOCAB } from './index.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'c-cam');
const A = VOCAB.acting;

let baker: InkPerson;

beforeAll(async () => {
  const file = pathToFileURL(path.join(EXAMPLES, 'people', 'nightBaker.js')).href;
  baker = personFromModule(await import(file), 'kit-ext/people/nightBaker.js');
});

const pair = (gap = 260) => ({
  a: { who: baker, x: 900, y: 930, s: 0.9, view: 1 as const },
  b: { who: baker, x: 900 + gap, y: 930, s: 0.9, view: -1 as const },
});

const dist = (p: Point2, q: Point2): number => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** World palm of a cue (the placement and pose it gives back). */
function palmOf(cue: ReturnType<typeof A.bow>['a'], side: 'L' | 'R'): Point2 {
  const yaw = typeof cue.view === 'number' ? cue.view : 0;
  return palmWorld(
    {
      character: baker.character,
      placement: { x: cue.x, y: cue.y, s: cue.s, yaw, bow: cue.bow, lean: cue.lean },
      pose: cue.pose,
    },
    side,
  );
}

describe('Grim Ink acting vocabulary', () => {
  it('meets palms in a handshake and pumps on twos', () => {
    const mid = A.handshake({ ...pair(), t: 0.7, t0: 0 });
    expect(mid.contact).toBeDefined();
    expect(dist(palmOf(mid.a, 'R'), palmOf(mid.b, 'R'))).toBeLessThan(4);
    const later = A.handshake({ ...pair(), t: 0.85, t0: 0 });
    expect(later.contact?.[1]).not.toBe(mid.contact?.[1]);
  });

  it('holds still before t0 and is a pure function of its options', () => {
    const before = A.push({ ...pair(), t: 0.5, t0: 1 });
    expect(before.u).toBe(0);
    expect(before.a.pose).toEqual({ ...baker.pose('stand'), ...before.a.pose });
    expect(A.push({ ...pair(), t: 1.4, t0: 1 })).toEqual(A.push({ ...pair(), t: 1.4, t0: 1 }));
  });

  it("puts the pusher's palms on the other's chest and moves the other back", () => {
    const res = A.push({ ...pair(220), t: 0.5, t0: 0 });
    expect(res.b.x).toBeGreaterThan(1120);
    expect(dist(palmOf(res.a, 'L'), res.contact ?? [0, 0])).toBeLessThan(40);
  });

  it('hits on the beat in a clink and aims the held things at the contact', () => {
    const early = A.clink({ ...pair(), t: 0.2, t0: 0 });
    expect(early.impact).toBeUndefined();
    const hit = A.clink({ ...pair(), t: 0.5, t0: 0, gap: 60 });
    expect(hit.impact?.t0).toBeCloseTo(0.42, 5);
    expect(hit.a.expr).toBe('shock');
    expect(hit.gripA && hit.contact && Math.abs(dist(hit.gripA, hit.contact) - 60)).toBeLessThan(
      25,
    );
    expect(hit.a.headDy + hit.b.headDy).toBeLessThan(0);
  });

  it('carries a thing from a to b and sags the receiver', () => {
    const start = A.handOver({ ...pair(), t: 0, t0: 0, weight: 1 });
    const end = A.handOver({ ...pair(), t: 1.2, t0: 0, weight: 1 });
    expect(start.item?.held).toBe('a');
    expect(end.item?.held).toBe('b');
    expect(end.item?.x ?? 0).toBeGreaterThan((start.item?.x ?? 0) + 60);
    expect(end.b.pose.bob).toBeCloseTo(0.07, 5);
    const mid = A.handOver({ ...pair(), t: 0.5, t0: 0, arc: 80 });
    expect(mid.item?.y ?? 0).toBeLessThan(Math.min(start.item?.y ?? 0, end.item?.y ?? 0));
  });

  it("catches a dropped thing in the other's palm, or rolls it to their feet", () => {
    const caught = A.dropCatch({ ...pair(220), t: 0.6, t0: 0 });
    expect(caught.item?.held).toBe('b');
    expect(dist(palmOf(caught.b, 'R'), [caught.item?.x ?? 0, caught.item?.y ?? 0])).toBeLessThan(
      25,
    );
    const lost = A.dropCatch({ ...pair(220), t: 1.0, t0: 0, catch: false });
    expect(lost.item?.held).toBe('none');
    expect(lost.item?.y ?? 0).toBeGreaterThan(900);
  });

  it('bows the second lower, turns the target round, shakes a head, lands a hand on a shoulder', () => {
    const bow = A.bow({ ...pair(), t: 1.2, t0: 0, depth: 20, outdo: 10 });
    expect(bow.b.bow - bow.a.bow).toBeCloseTo(10, 5);
    const back = { ...pair(), b: { ...pair().b, view: 3 as const } };
    expect(A.pointTurn({ ...back, t: 0.1, t0: 0 }).b.view).toBe(3);
    expect(A.pointTurn({ ...back, t: 1.2, t0: 0 }).b.view).toBe(-1);
    const yaws = [0.1, 0.35, 0.6, 0.85].map(
      (t) => A.headShake({ a: pair().a, t, t0: 0, period: 0.25 }).a.headYaw,
    );
    expect(new Set(yaws).size).toBe(3);
    const on = A.handOn({ ...pair(150), t: 0.8, t0: 0 });
    expect(dist(palmOf(on.a, 'R'), on.contact ?? [0, 0])).toBeLessThan(6);
  });

  it('stumbles toward the other, who catches; flinches; tugs; takes a double take', () => {
    const fall = A.stumble({ ...pair(), t: 0.3, t0: 0 });
    expect(Math.abs(fall.a.lean)).toBeGreaterThan(10);
    expect(fall.contact).toBeDefined();
    expect(A.flinch({ ...pair(), t: 0.3, t0: 0 }).b.expr).toBe('scared');
    const tug = A.tug({ ...pair(), t: 1.0, t0: 0 });
    expect(tug.item).toBeDefined();
    const look = A.doubleTake({ ...pair(), t: 0.7, t0: 0 });
    expect(look.a.expr).toBe('shock');
    expect(look.a.headYaw).toBe(1);
  });

  it('accepts a character record as well as a person handle, and checks its options', () => {
    const viaRecord = A.handshake({
      a: { ...pair().a, who: baker.character },
      b: pair().b,
      t: 0.7,
      t0: 0,
    });
    expect(viaRecord).toEqual(A.handshake({ ...pair(), t: 0.7, t0: 0 }));
    expect(() => A.handshake({ a: { ...pair().a, who: {} as never }, b: pair().b })).toThrow(
      /who must be a person/,
    );
    expect(() => A.bow({ ...pair(), depth: 500 })).toThrow(/kit-docs ink-acting/);
  });
});
