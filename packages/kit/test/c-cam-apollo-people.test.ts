/**
 * The five people of the C-CAM Apollo 11 film ported to Grim Ink people modules (PLAN.md#14.9):
 * `examples/c-cam/apollo/people/<id>.js`. Each module passes the ink-module lint and the kit
 * loader, the character validators find no errors, and the module draws call for call what the
 * original cast file (`docs/concepts/c-cam-style/films/03-apollo-11/js/cast/<id>.js`, run in a VM
 * with its engine scripts) draws for the same view, pose, expression and time, once the
 * documented validator fixes (`FIXES`) are applied to the original source too.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { lintInkModule } from '../../engine/src/lint/lint-ink-module.js';
import { LegacyRecordingPaint } from '../src/worlds/c-cam/draw/original.js';
import { RecordingPaint } from '../src/worlds/c-cam/draw/recording-paint.js';
import type { Pose, PoseName } from '../src/worlds/c-cam/draw/poses.js';
import { personFromModule, type InkPerson } from '../src/worlds/c-cam/modules/person.js';
import { validateCharacter } from '../src/worlds/c-cam/validate/index.js';

const KIT = path.resolve(import.meta.dirname, '..');
const PEOPLE_DIR = path.join(KIT, 'examples', 'c-cam', 'apollo', 'people');
const FILM_JS = path.resolve(KIT, '..', '..', 'docs', 'concepts', 'c-cam-style', 'films');
const ORIGINAL_DIR = path.join(FILM_JS, '03-apollo-11', 'js');
const ENGINE = ['core.js', 'brushes.js', 'face.js', 'grime.js', 'rig.js', 'poses.js', 'props.js'];
const IDS = ['commander', 'guidance', 'orbiter', 'director', 'you'] as const;
type ApolloId = (typeof IDS)[number];

const DEFAULT_EXPR: Readonly<Record<ApolloId, string>> = {
  commander: 'deadpan',
  guidance: 'focused',
  orbiter: 'sad',
  director: 'deadpan',
  you: 'scared',
};

/**
 * The only differences from the film (`[original text, port text]` in the cast file): face-guard
 * boxes lowered / widened to the measured head (validator `hand-in-head`), and two head holes
 * closed (validator `head-pieces`): the director's headset band lowered onto the bald dome, the
 * orbiter's double-chin stroke lifted 2 px onto the chin.
 */
const FIXES: Readonly<Record<ApolloId, readonly (readonly [string, string])[]>> = {
  commander: [['bottom: -598, hw: 78', 'bottom: -585, hw: 78']],
  guidance: [['bottom: -620, hw: 74', 'bottom: -595, hw: 80']],
  orbiter: [
    ['bottom: -560, hw: 96', 'bottom: -551, hw: 96'],
    ['[-36, 4 + jaw, 0, 18 + jaw, 36, 4 + jaw]', '[-36, 4 + jaw, 0, 16 + jaw, 36, 4 + jaw]'],
  ],
  director: [
    ['bottom: -580, hw: 86', 'bottom: -566, hw: 86'],
    [
      '[-70, -96, -60, -160, 0, -184, 60, -160, 70, -96]',
      '[-70, -96, -60, -154, 0, -176, 60, -154, 70, -96]',
    ],
    ['[-58, -96, -46, -164, 10, -186, 56, -164]', '[-58, -96, -46, -158, 10, -176, 56, -158]'],
  ],
  you: [['bottom: -596, hw: 70', 'bottom: -585, hw: 70']],
};

async function load(id: ApolloId): Promise<InkPerson> {
  const namespace: unknown = await import(pathToFileURL(path.join(PEOPLE_DIR, `${id}.js`)).href);
  return personFromModule(namespace, `kit-ext/people/${id}.js`);
}

/** Loosely typed original engine and cast record (test oracle). */
interface OriginalCast {
  readonly D: unknown;
  readonly draw: (ctx: LegacyRecordingPaint, props: Record<string, unknown>) => void;
}
interface OriginalEngine {
  CAST: Record<string, OriginalCast | undefined>;
  pose: (name: string, D: unknown, ph?: number | null, over?: unknown) => unknown;
  youRead: (D: unknown) => Partial<Pose>;
  directorSip: (D: unknown, up: number) => Partial<Pose>;
  LW: number;
  camZ: number;
}

function originalCast(id: ApolloId): { cast: OriginalCast; st: OriginalEngine } {
  const sandbox: { window: { ST?: OriginalEngine } } = { window: {} };
  for (const file of ENGINE)
    runInNewContext(readFileSync(path.join(ORIGINAL_DIR, file), 'utf8'), sandbox);
  let source = readFileSync(path.join(ORIGINAL_DIR, 'cast', `${id}.js`), 'utf8');
  for (const [from, to] of FIXES[id]) {
    expect(source.includes(from), `${id}: fix target ${from}`).toBe(true);
    source = source.replaceAll(from, to);
  }
  runInNewContext(source, sandbox);
  const st = sandbox.window.ST;
  const cast = st?.CAST[id];
  if (!st || !cast) throw new Error(`original cast/${id}.js did not register ST.CAST.${id}`);
  st.LW = 1;
  st.camZ = 1;
  return { cast, st };
}

const CASES: readonly { pose: PoseName; ph: number; yaws: readonly number[]; expr?: string }[] = [
  { pose: 'stand', ph: 0, yaws: [0, 1, 2, 3, -1, -2, -3] },
  { pose: 'akimbo', ph: 0, yaws: [0, 1, 2, 3, -1, -2], expr: 'shock' },
  { pose: 'walk', ph: 0.3, yaws: [0, 1, 2, -1], expr: 'rage' },
  { pose: 'jig', ph: 0.25, yaws: [0, 2, 3, -2], expr: 'grin' },
  { pose: 'flail', ph: 0.75, yaws: [0, 1, -1], expr: 'yelling' },
];

/** Shot props the film's cast files read (`p.chew`, `p.mug`...), with the pose they need. */
interface PropCase {
  readonly props: Readonly<Record<string, number | boolean>>;
  readonly t: number;
  readonly over?: (st: OriginalEngine, D: unknown) => Partial<Pose>;
}
const PROP_CASES: Readonly<Record<ApolloId, readonly PropCase[]>> = {
  commander: [
    { props: { chew: true, bubble: 0.7 }, t: 0.3 },
    { props: { chew: true }, t: 0.45 },
    { props: { helmet: 2 }, t: 0.05 },
  ],
  guidance: [],
  orbiter: [
    { props: { sandwich: 1 }, t: 0.4 },
    { props: { sandwich: 0 }, t: 0.05 },
  ],
  director: [
    { props: { mug: 0, steam: true }, t: 0.2 },
    { props: { mug: -40, sip: true }, t: 0.05, over: (st, D) => st.directorSip(D, 1) },
  ],
  you: [
    { props: { sweat: true, checklist: 0.3 }, t: 0.3, over: (st, D) => st.youRead(D) },
    { props: { helmet: 1, helmetDy: 6, sweat: true }, t: 0.7 },
  ],
};

describe('Apollo 11 people modules (PLAN.md#14.9)', () => {
  it.each(IDS)('%s passes the ink-module lint and the loader', async (id) => {
    const source = readFileSync(path.join(PEOPLE_DIR, `${id}.js`), 'utf8');
    expect(lintInkModule(source, { filename: `kit-ext/people/${id}.js` }, 'people')).toEqual([]);
    const person = await load(id);
    expect(person.id).toBe(id);
    expect(person.character.defaultExpr).toBe(DEFAULT_EXPR[id]);
  });

  it.each(IDS)('%s has no validator errors', async (id) => {
    const report = validateCharacter((await load(id)).character);
    expect(report.findings.filter((finding) => finding.severity === 'error')).toEqual([]);
  });

  it.each(IDS)('%s draws call for call what the original cast file draws', async (id) => {
    const person = await load(id);
    const { cast, st } = originalCast(id);
    for (const c of CASES) {
      for (const yaw of c.yaws) {
        const expected = new LegacyRecordingPaint();
        const actual = new RecordingPaint();
        const expr = c.expr ?? DEFAULT_EXPR[id];
        const at = { x: 900, y: 1000, s: 0.9, t: 0.05 };
        cast.draw(expected, { ...at, yaw, expr, pose: st.pose(c.pose, cast.D, c.ph) });
        person.draw(actual, undefined, { ...at, view: yaw, expr, pose: person.pose(c.pose, c.ph) });
        expect(actual.calls.length).toBeGreaterThan(100);
        expect(actual.toLines(), `${id} ${c.pose} yaw ${String(yaw)}`).toEqual(expected.toLines());
      }
    }
  });

  it.each(IDS)(
    '%s draws the film props (gum, mug, sandwich, sweat, checklist, helmet) as the original',
    async (id) => {
      const person = await load(id);
      const { cast, st } = originalCast(id);
      for (const c of PROP_CASES[id]) {
        for (const yaw of [0, 1, 2, 3, -1, -2]) {
          const expected = new LegacyRecordingPaint();
          const actual = new RecordingPaint();
          const over = c.over?.(st, cast.D) ?? {};
          const at = { x: 900, y: 1000, s: 0.9, t: c.t, expr: DEFAULT_EXPR[id] };
          cast.draw(expected, {
            ...at,
            yaw,
            pose: st.pose('stand', cast.D, null, over),
            ...c.props,
          });
          const pose = person.pose('stand', 0, over);
          person.draw(actual, undefined, { ...at, view: yaw, pose, props: c.props });
          const label = `${id} ${JSON.stringify(c.props)} yaw ${String(yaw)}`;
          expect(actual.toLines(), label).toEqual(expected.toLines());
        }
      }
    },
  );

  it.each(IDS)('%s states a signature gag', async (id) => {
    const person = await load(id);
    expect(person.character.signatureGag?.note.length ?? 0).toBeGreaterThan(10);
    const report = validateCharacter(person.character, { rules: ['no-signature-gag'] });
    expect(report.findings).toEqual([]);
  });
});
