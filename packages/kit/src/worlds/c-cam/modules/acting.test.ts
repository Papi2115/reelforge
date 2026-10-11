/**
 * Per-shot acting of Grim Ink people (PLAN.md#14.9): shot props reach the module as `p`, the
 * module hooks (`arms`, `held`, `beforeHand`) and the gags fold into the rig, places take options
 * and a foreground. Unit level on the sample modules and the test character.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { KitError } from '../../../errors.js';
import { RecordingPaint } from '../draw/recording-paint.js';
import { GAG_DOCS, GAG_KINDS, GAG_PERIOD, bump, gagPhase, gagSpecSchema } from '../draw/gags.js';
import { TEST_CHARACTER } from '../draw/test-character.js';
import { validateCharacter } from '../validate/index.js';
import { C_CAM_VOCABULARY } from '../vocabulary.js';
import { faceSpots } from './person-acting.js';
import { definePerson, personFromModule, type InkPerson } from './person.js';
import { definePlace, placeFromModule } from './place.js';

const EXAMPLES = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'examples', 'c-cam');

async function load(kind: 'people' | 'places', file: string): Promise<unknown> {
  const namespace: unknown = await import(pathToFileURL(path.join(EXAMPLES, kind, file)).href);
  return namespace;
}

const baker = async (): Promise<InkPerson> =>
  personFromModule(await load('people', 'nightBaker.js'), 'kit-ext/people/nightBaker.js');

function drawn(person: InkPerson, opts: Parameters<InkPerson['draw']>[2]): string[] {
  const g = new RecordingPaint();
  person.draw(g, undefined, { x: 900, y: 1000, s: 0.8, ...opts });
  return g.toLines();
}

describe('gags (PLAN.md#14.9)', () => {
  it('lists every kind once, documented, in the vocabulary', () => {
    expect(new Set(GAG_KINDS).size).toBe(GAG_KINDS.length);
    expect(C_CAM_VOCABULARY.gags).toEqual(GAG_KINDS);
    for (const kind of GAG_KINDS) {
      expect(GAG_DOCS[kind].length, kind).toBeGreaterThan(20);
      expect(GAG_PERIOD[kind], kind).toBeGreaterThan(0);
    }
  });

  it('cycles on twos from t0 and eases its envelope', () => {
    const gag = gagSpecSchema.parse({ kind: 'sip', t0: 1 });
    expect(gagPhase(gag, 0.9)).toBeUndefined();
    expect(gagPhase(gag, 1)).toBe(0);
    expect(gagPhase(gag, 1.01)).toBe(0);
    expect(gagPhase(gag, 1 + GAG_PERIOD.sip / 2)).toBeCloseTo(0.5, 9);
    expect(gagPhase({ ...gag, rate: 2 }, 1 + GAG_PERIOD.sip / 2)).toBeCloseTo(0, 9);
    expect(bump(0.1, 0.2, 0.3, 0.6, 0.7)).toBe(0);
    expect(bump(0.45, 0.2, 0.3, 0.6, 0.7)).toBe(1);
    expect(bump(0.65, 0.2, 0.3, 0.6, 0.7)).toBeCloseTo(0.5, 9);
    expect(bump(0.9, 0.2, 0.3, 0.6, 0.7)).toBe(0);
  });

  it.each(GAG_KINDS)('%s acts on a person, deterministically, in every view', async (kind) => {
    const person = await baker();
    // A moment in the middle of the action of every kind (sip 0.6 = mug at the lips).
    const t = GAG_PERIOD[kind] * 0.6;
    for (const view of [0, 1, 2, 3, -1, -2]) {
      const still = drawn(person, { view, t });
      const acting = drawn(person, { view, t, gag: { kind, visor: true } });
      expect(acting).toEqual(drawn(person, { view, t, gag: { kind, visor: true } }));
      // glance and the face-only gags change nothing seen from the back.
      if (view !== 3) expect(acting, `${kind} view ${String(view)}`).not.toEqual(still);
    }
  });

  it('holds still before t0 and takes two gags at once, never three', async () => {
    const person = await baker();
    const still = drawn(person, { t: 0.5 });
    expect(drawn(person, { t: 0.5, gag: { kind: 'sip', t0: 2 } })).toEqual(still);
    const two = drawn(person, { t: 3, gag: [{ kind: 'sweat' }, { kind: 'sip', hand: 'L' }] });
    expect(two).not.toEqual(drawn(person, { t: 3, gag: { kind: 'sweat' } }));
    const three = [{ kind: 'sweat' }, { kind: 'gum' }, { kind: 'yawn' }] as const;
    expect(() => drawn(person, { gag: three })).toThrow(/at most 2/);
    expect(() => drawn(person, { gag: { kind: 'juggle' as 'gum' } })).toThrow(KitError);
  });

  it('places face marks from the face anchors, else from the head box', () => {
    const spots = faceSpots(TEST_CHARACTER, 0);
    expect(spots.mouth).toEqual(TEST_CHARACTER.faceAnchors?.[0].mouth);
    const bare = faceSpots({ ...TEST_CHARACTER, faceAnchors: undefined } as never, 2);
    expect(bare.mouth[1]).toBeGreaterThan(bare.forehead[1]);
    expect(bare.rx).toBeGreaterThan(0);
  });
});

describe('person props and module hooks', () => {
  it('rejects props that are not plain values', async () => {
    const person = await baker();
    const bad = { mug: () => 1 } as unknown as Record<string, number>;
    expect(() => drawn(person, { props: bad })).toThrow(/props must be an object of plain values/);
  });

  it('hands props and t to the drawings, and arms / held / beforeHand to the rig', async () => {
    const seen: string[] = [];
    const base = (await load('people', 'nightBaker.js')) as { person: Record<string, unknown> };
    const person = definePerson({
      ...base.person,
      id: 'probe',
      head(_g: unknown, _ink: unknown, view: number, _face: unknown, p: { t: number }) {
        seen.push(`head ${String(view)} t=${String(p.t)}`);
      },
      arms: (p: { cup?: number }) => (p.cup === undefined ? undefined : { R: { hand: 'open' } }),
      held(_g: unknown, _ink: unknown, side: string, palm: readonly number[], p: { cup?: number }) {
        if (p.cup !== undefined) seen.push(`held ${side} ${String(palm.length)}`);
      },
      beforeHand(_g: unknown, _ink: unknown, _J: unknown, view: number) {
        seen.push(`beforeHand ${String(view)}`);
      },
    });
    drawn(person, { view: 0, t: 1.25, props: { cup: 1 } });
    expect(seen).toContain('head 0 t=1.25');
    expect(seen).toContain('held R 2');
    expect(seen).toContain('held L 2');
    expect(seen).toContain('beforeHand 0');
    const broken = definePerson({
      ...base.person,
      id: 'broken',
      arms: () => ({ R: { hand: 'claw' } }),
    });
    expect(() => drawn(broken, {})).toThrow(/arms\(p\) must return/);
  });

  it('warns about a person without a signature gag (validator)', () => {
    const plain = { ...TEST_CHARACTER, signatureGag: undefined } as never;
    const report = validateCharacter(plain, { rules: ['no-signature-gag'] });
    expect(report.findings.map((f) => [f.code, f.severity])).toEqual([
      ['no-signature-gag', 'warn'],
    ]);
    expect(validateCharacter(TEST_CHARACTER, { rules: ['no-signature-gag'] }).findings).toEqual([]);
  });
});

describe('place options and foreground', () => {
  it('passes extra options to the module, keeps the 3-argument call, checks them', () => {
    const seen: unknown[] = [];
    const place = definePlace({
      id: 'probe',
      name: 'Probe',
      bounds: [1920, 1080],
      draw: (_g: unknown, _ink: unknown, t: number, opts: unknown) => seen.push(['draw', t, opts]),
      foreground: (_g: unknown, _ink: unknown, t: number, opts: unknown) =>
        seen.push(['front', t, opts]),
    });
    const g = new RecordingPaint();
    place.draw(g, undefined, 1);
    place.draw(g, undefined, 2, { light: false, alarm: true, k: 0.4 });
    place.foreground(g, undefined, 3, { smoke: false });
    expect(seen).toEqual([
      ['draw', 1, {}],
      ['draw', 2, { alarm: true, k: 0.4 }],
      ['front', 3, { smoke: false }],
    ]);
    expect(place.hasForeground).toBe(true);
    const bad = { at: new Date(0) } as unknown as Record<string, number>;
    expect(() => {
      place.draw(g, undefined, 0, bad);
    }).toThrow(/opts must be an object/);
    expect(() => {
      place.draw(g, undefined, 0, { light: 1 } as unknown as { light: boolean });
    }).toThrow(/opts.light/);
  });

  it('draws nothing as foreground without one', async () => {
    const room = placeFromModule(
      await load('places', 'bakeryBackRoom.js'),
      'kit-ext/places/bakeryBackRoom.js',
    );
    const g = new RecordingPaint();
    room.foreground(g, undefined, 0);
    expect(g.calls).toEqual([]);
    expect(room.hasForeground).toBe(false);
  });
});
