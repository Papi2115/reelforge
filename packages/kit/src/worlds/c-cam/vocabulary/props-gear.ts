/**
 * Grim Ink props (PLAN.md#14.20): weapons with wear and state (sword, dagger, spear, club, axe,
 * shield) and tools (hammer, shovel, broom, key, saw, wrench, walking stick, seal stamp). Ported
 * from `01-samurai-edo/js/props.js` (daisho / rackSword gleam, hanko),
 * `02-papal-conclave/js/cast/mayor.js` (the big key that turns), `cast/gregory.js` (stick). Held
 * things: grip at the origin, the working end toward +x; `rot` 90 points it down. Docs in props.ts.
 */
import { z } from 'zod';
import { C, rnd } from '../core.js';
import { brushStroke, type BrushEnv } from '../draw/brushes.js';
import type { Paint2D } from '../draw/paint.js';
import { rect, rough } from '../draw/scenery.js';
import { blob, ellipseRing, tube } from '../draw/shapes.js';
import {
  coord,
  local,
  place,
  rotSchema,
  seedSchema,
  sizeSchema,
  toneOf,
  toneSchema,
  unit,
  wearMarks,
  wearSchema,
  type Drawn,
} from './common.js';

// ---------- weapon ----------

export const weaponSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  kind: z.enum(['sword', 'dagger', 'spear', 'club', 'axe', 'shield']).default('sword'),
  state: z.enum(['drawn', 'sheathed', 'broken', 'bent']).default('drawn'),
  rot: rotSchema,
  size: sizeSchema,
  gleam: unit.default(0),
  tone: toneSchema.optional(),
  wear: wearSchema,
  seed: seedSchema.default(660),
});

const LENGTH = { sword: 300, dagger: 130, spear: 620, club: 240, axe: 300, shield: 0 } as const;

function blade(
  g: Paint2D,
  e: BrushEnv,
  o: z.output<typeof weaponSchema>,
  len: number,
  width: number,
): number {
  const [steel, steelD] = toneOf(o.tone ?? 'steel');
  const end = o.state === 'broken' ? len * 0.55 : len;
  const bend = o.state === 'bent' ? len * 0.12 : 0;
  // prettier-ignore
  const pts = o.state === 'broken' ? [8, -width / 2, end, -width / 2 + 2, end - 10, 0, end + 4, width / 2 - 2, 8, width / 2] : [8, -width / 2, end * 0.55, -width / 2 - bend * 0.5, end - width, -width / 2 - bend, end, -bend, end - width * 0.6, width / 2 - bend, end * 0.55, width / 2 - bend * 0.5, 8, width / 2];
  blob(g, e, pts, steel, {
    sharp: true,
    lw: 5,
    seed: o.seed + 3,
    shade: [steelD, 0, width * 0.3],
    light: ['rgba(240,232,210,0.35)', 0, -3],
  });
  for (let i = 0; i < Math.round(o.wear * 4); i += 1) {
    const nx = rnd(0.2, 0.85, o.seed, i) * end;
    blob(g, e, [nx, -width / 2 - 1, nx + 6, -width / 2 + 4, nx + 10, -width / 2 - 1], C.INK, {
      sharp: true,
      lw: 0,
      seed: o.seed + 30 + i,
    });
  }
  return end;
}

export function drawWeapon(g: Paint2D, e: BrushEnv, o: z.output<typeof weaponSchema>): Drawn {
  const [wood, woodD] = toneOf(o.kind === 'shield' ? (o.tone ?? 'wood') : 'wood');
  const len = LENGTH[o.kind];
  let tipX: number = len;
  local(g, o.x, o.y, o.rot, o.size, () => {
    if (o.kind === 'sword' || o.kind === 'dagger') {
      const k = o.kind === 'sword' ? 1 : 0.7;
      if (o.state === 'sheathed') {
        tube(g, e, [10, 0, len * 0.5, 3, len, 0], [22 * k + 4, 21 * k + 4, 19 * k + 4], C.BLACK, {
          lw: 5,
          seed: o.seed,
          light: ['#4a4540', 2, -3],
        });
        tube(g, e, [len * 0.94, 0, len, 0], [21 * k + 6, 21 * k + 6], '#57503f', {
          lw: 4,
          seed: o.seed + 1,
        });
      } else tipX = blade(g, e, o, len, 18 * k);
      tube(g, e, [-len * 0.26, 2, -6, 0], [18 * k + 2, 20 * k + 2], '#2a2a2c', {
        lw: 5,
        seed: o.seed + 4,
      });
      for (let j = 1; j < 4; j += 1) {
        const u = -len * 0.26 + (len * 0.2 * j) / 4;
        brushStroke(g, e, [u - 6, -7, u + 6, 7], {
          w: 3,
          color: '#8a826c',
          seed: o.seed + 5 + j,
          taper: false,
        });
      }
      blob(g, e, ellipseRing(-2, 0, 8 * k + 2, 18 * k + 4, 8), '#3d3a33', {
        lw: 4,
        seed: o.seed + 9,
        light: ['#6a6352', 2, -3],
      });
    }
    if (o.kind === 'spear' || o.kind === 'axe' || o.kind === 'club') {
      const shaft = o.state === 'broken' ? len * 0.5 : len * (o.kind === 'spear' ? 0.86 : 1);
      const w0 = o.kind === 'club' ? 22 : 14;
      const w1 = o.kind === 'club' ? 46 : 13;
      tube(g, e, [-len * 0.15, 0, shaft, 0], [w0, w1], wood, {
        lw: 5,
        seed: o.seed,
        shade: [woodD, 0, 3],
        ...(o.kind === 'club'
          ? { hatch: { c: 'rgba(14,10,6,0.5)', n: 3, len: 30, gap: 6, k: 2, ang: 0 } }
          : {}),
      });
      if (o.state === 'broken')
        blob(
          g,
          e,
          [shaft - 4, -8, shaft + 14, -4, shaft + 2, 0, shaft + 16, 6, shaft - 4, 8],
          wood,
          { sharp: true, lw: 4, seed: o.seed + 1 },
        );
      if (o.kind === 'spear' && o.state !== 'broken') {
        const [steel, steelD] = toneOf(o.tone ?? 'steel');
        blob(g, e, [shaft - 8, -6, shaft + 30, -16, len, 0, shaft + 30, 16, shaft - 8, 6], steel, {
          lw: 5,
          seed: o.seed + 2,
          shade: [steelD, 0, 4],
        });
      }
      if (o.kind === 'axe' && o.state !== 'broken') {
        const [steel, steelD] = toneOf(o.tone ?? 'iron');
        // prettier-ignore
        blob(g, e, [len - 50, -10, len - 70, -60, len - 10, -76, len + 4, -40, len - 10, -10], steel, { lw: 5, seed: o.seed + 2, shade: [steelD, -4, 4], light: ['rgba(220,215,190,0.3)', 3, -3] });
      }
      if (o.kind === 'club')
        for (let i = 0; i < 3; i += 1)
          blob(
            g,
            e,
            ellipseRing(len * rnd(0.5, 0.9, o.seed, i), rnd(-10, 10, o.seed, i, 1), 6, 5, 6),
            woodD,
            { lw: 2, seed: o.seed + 10 + i },
          );
      tipX = o.state === 'broken' ? shaft : len;
    }
    if (o.kind === 'shield') {
      const r = 120;
      const ring = ellipseRing(0, 0, r, r, 16);
      if (o.state === 'broken') ring.splice(4, 4, r * 0.3, r * 0.2, r * 0.5, r * 0.6);
      blob(g, e, ring, wood, {
        lw: 8,
        seed: o.seed,
        shade: [woodD, -14, 10],
        hatch: { c: 'rgba(14,10,6,0.45)', n: 4, len: 70, gap: 9, k: 2, ang: 90, bend: 0 },
      });
      for (const dx of [-60, 0, 60])
        brushStroke(g, e, [dx, -r * 0.9, dx + 2, r * 0.9], {
          w: 3,
          color: woodD,
          seed: o.seed + 1,
          taper: false,
        });
      blob(g, e, ellipseRing(0, 0, r, r, 16), 'rgba(0,0,0,0)', {
        lw: 14,
        lineColor: '#3b3a36',
        seed: o.seed + 2,
      });
      blob(g, e, ellipseRing(0, 0, 28, 28, 10), C.STONE, {
        lw: 5,
        seed: o.seed + 3,
        light: ['rgba(230,225,200,0.35)', 4, -4],
      });
      wearMarks(g, e, [-r * 0.7, -r * 0.7, r * 0.7, r * 0.7], o.wear, o.seed + 20);
      tipX = 0;
    }
    if (o.gleam > 0 && o.kind !== 'shield') {
      const cx = tipX * 0.6;
      const rr = 24 + 44 * o.gleam;
      // prettier-ignore
      blob(g, e, [cx - rr, -4, cx - 5, -9, cx, -4 - rr, cx + 5, -9, cx + rr, -4, cx + 5, 1, cx, rr - 4, cx - 5, 1], '#efe7c8', { sharp: true, lw: 0, seed: o.seed + 40 });
    }
  });
  const k = o.size;
  const tip = place(o.x, o.y, o.rot, tipX * k, 0);
  const pommel = place(o.x, o.y, o.rot, (o.kind === 'shield' ? 0 : -len * 0.26) * k, 0);
  const r = o.kind === 'shield' ? 130 * k : 30 * k;
  return {
    box: [
      Math.min(tip[0], pommel[0]) - r,
      Math.min(tip[1], pommel[1]) - r,
      Math.max(tip[0], pommel[0]) + r,
      Math.max(tip[1], pommel[1]) + r,
    ],
    points: { grip: [o.x, o.y], tip, pommel },
  };
}

// ---------- tool ----------

export const toolSchema = z.strictObject({
  x: coord.default(960),
  y: coord.default(540),
  kind: z
    .enum(['hammer', 'shovel', 'broom', 'key', 'saw', 'wrench', 'stick', 'stamp'])
    .default('hammer'),
  rot: rotSchema,
  size: sizeSchema,
  turn: unit.default(0),
  state: z.enum(['whole', 'broken']).default('whole'),
  tone: toneSchema.optional(),
  wear: wearSchema,
  seed: seedSchema.default(700),
});

const TOOL_LEN = {
  hammer: 200,
  shovel: 520,
  broom: 520,
  key: 210,
  saw: 300,
  wrench: 220,
  stick: 420,
  stamp: 80,
} as const;

export function drawTool(g: Paint2D, e: BrushEnv, o: z.output<typeof toolSchema>): Drawn {
  const len = TOOL_LEN[o.kind];
  const [wood, woodD] = toneOf('wood');
  const [metal, metalD] = toneOf(
    o.tone ?? (o.kind === 'key' ? 'brass' : o.kind === 'stamp' ? 'paleWood' : 'iron'),
  );
  const shaftEnd = o.state === 'broken' ? len * 0.5 : len;
  local(g, o.x, o.y, o.rot, o.size, () => {
    if (o.kind === 'key') {
      g.save();
      g.scale(1, Math.max(0.08, Math.cos((o.turn * Math.PI) / 2)));
      blob(g, e, ellipseRing(-24, 0, 34, 26, 10), metal, {
        lw: 6,
        seed: o.seed,
        shade: [metalD, -6, 5],
        inner: () => blob(g, e, ellipseRing(-28, 0, 14, 10, 8), C.INK, { lw: 0, seed: o.seed + 1 }),
      });
      g.restore();
      rect(g, e, 6, -9, 200, 18, metal, { seed: o.seed + 2, lw: 5, amp: 1, shade: [metalD, 0, 5] });
      rough(g, e, [176, 8, 210, 8, 210, 56, 196, 56, 196, 40, 186, 40, 186, 56, 176, 56], metal, {
        seed: o.seed + 3,
        lw: 5,
        amp: 1,
        shade: [metalD, -4, 4],
      });
      return;
    }
    if (o.kind === 'stamp') {
      rough(g, e, [-26, -14, len, -16, len + 4, 16, -26, 14], metal, {
        seed: o.seed,
        lw: 5,
        amp: 1,
        shade: [metalD, 0, 5],
      });
      rect(g, e, len - 6, -18, 14, 36, C.RED_D, { seed: o.seed + 1, lw: 3 });
      return;
    }
    const handle = o.kind === 'stick' ? C.TIMBER : wood;
    tube(g, e, [-len * 0.1, 0, shaftEnd, 0], [16, 15], handle, {
      lw: 5,
      seed: o.seed,
      shade: [woodD, 0, 3],
    });
    if (o.kind === 'stick')
      tube(g, e, [-len * 0.1, 0, -len * 0.16, -24, -len * 0.08, -40], [16, 15, 14], handle, {
        lw: 5,
        seed: o.seed + 1,
      });
    if (o.state === 'broken') {
      blob(
        g,
        e,
        [shaftEnd - 4, -8, shaftEnd + 14, -4, shaftEnd + 2, 0, shaftEnd + 16, 6, shaftEnd - 4, 8],
        handle,
        { sharp: true, lw: 4, seed: o.seed + 2 },
      );
      return;
    }
    if (o.kind === 'hammer')
      rect(g, e, len - 14, -40, 34, 80, metal, { seed: o.seed + 3, lw: 5, shade: [metalD, 0, 6] });
    if (o.kind === 'shovel')
      blob(
        g,
        e,
        [
          len - 6,
          -14,
          len + 30,
          -50,
          len + 120,
          -40,
          len + 140,
          0,
          len + 120,
          40,
          len + 30,
          50,
          len - 6,
          14,
        ],
        metal,
        { lw: 5, seed: o.seed + 3, shade: [metalD, 0, 8] },
      );
    if (o.kind === 'broom') {
      blob(g, e, [len - 6, -16, len + 140, -46, len + 150, 46, len - 6, 16], toneOf('straw')[0], {
        sharp: true,
        lw: 5,
        seed: o.seed + 3,
        hatch: { c: 'rgba(60,40,14,0.6)', n: 4, len: 60, gap: 5, k: 3, ang: 0, bend: 0.05 },
      });
      brushStroke(g, e, [len + 10, -20, len + 12, 20], {
        w: 6,
        color: C.RUST_D,
        seed: o.seed + 4,
        taper: false,
      });
    }
    if (o.kind === 'saw') {
      const teeth: number[] = [len * 0.15, -20, len, -14];
      for (let i = 0; i <= 12; i += 1) teeth.push(len - (i * len * 0.85) / 12, i % 2 ? 26 : 18);
      blob(g, e, teeth, metal, { sharp: true, lw: 4, seed: o.seed + 3, shade: [metalD, 0, 4] });
    }
    if (o.kind === 'wrench')
      blob(
        g,
        e,
        [
          len - 10,
          -14,
          len + 10,
          -40,
          len + 46,
          -36,
          len + 30,
          -12,
          len + 30,
          12,
          len + 46,
          36,
          len + 10,
          40,
          len - 10,
          14,
        ],
        metal,
        { sharp: true, lw: 5, seed: o.seed + 3, shade: [metalD, 0, 5] },
      );
    wearMarks(g, e, [-len * 0.1, -10, shaftEnd, 10], o.wear * 0.6, o.seed + 20);
  });
  const k = o.size;
  const head = place(
    o.x,
    o.y,
    o.rot,
    (o.kind === 'key'
      ? 196
      : o.kind === 'stamp'
        ? len
        : shaftEnd + (o.kind === 'shovel' || o.kind === 'broom' ? 120 : 0)) * k,
    0,
  );
  const tail = place(o.x, o.y, o.rot, -len * 0.16 * k, 0);
  return {
    box: [
      Math.min(head[0], tail[0]) - 60 * k,
      Math.min(head[1], tail[1]) - 60 * k,
      Math.max(head[0], tail[0]) + 60 * k,
      Math.max(head[1], tail[1]) + 60 * k,
    ],
    points: { grip: [o.x, o.y], head, tail },
  };
}
