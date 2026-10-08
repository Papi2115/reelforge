/**
 * `page.diagram(kind, spec)` (PLAN.md#13.15a): the notebook's diagram kit, built only from the
 * page's own methods (a scene could write the same): callout (a label with an arrow at a thing),
 * timeline, map (coast, route, a red X, places, compass), bars, line, pie, venn, flow, stack
 * (a list of facts) and cutaway (layers). The hand draws the structure; small labels appear on
 * their own (`labels: 'hand'` writes them too); the `highlight` is the one red mark.
 */
import type { z } from 'zod';
import { KitError } from '../../../errors.js';
import { parse } from '../page/schemas.js';
import { DIAGRAM_KINDS, DIAGRAM_SCHEMAS, type DiagramKind } from './diagram-schemas.js';
import {
  chained,
  labeller,
  penOf,
  type DiagramHost,
  type Drawn,
  type Opts,
} from './diagram-kit.js';
import { arcFlat } from './gen/family.js';

export { DIAGRAM_KINDS, DIAGRAM_SCHEMAS, type DiagramHost, type DiagramKind, type Drawn };

type Spec<K extends DiagramKind> = z.output<(typeof DIAGRAM_SCHEMAS)[K]>;
const PALETTE = ['orange', 'skyPencil', 'green', 'sticky', 'purple', 'kraft'] as const;

export function drawDiagram(page: DiagramHost, kind: unknown, spec: unknown, call: string): Drawn {
  if (typeof kind !== 'string' || !(kind in DIAGRAM_SCHEMAS)) {
    throw new KitError(
      'invalid-params',
      `${call}: unknown diagram "${String(kind)}"; diagrams are ${DIAGRAM_KINDS.join(', ')}`,
    );
  }
  const k = kind as DiagramKind;
  const o = parse(DIAGRAM_SCHEMAS[k], spec, `${call}('${k}')`);
  const out: Drawn[] = [];
  const host = chained(page, o.at, out);
  const write = labeller(host, o);
  const tool = penOf(o.pen);
  const first = { tool };
  /** A structural line at a brisk ruling pace (a ballpoint is slow for long rules). */
  const rule = (points: number[], extra: Opts = {}): Drawn => {
    let length = 0;
    for (let i = 2; i + 1 < points.length; i += 2) {
      length += Math.hypot(
        (points[i] ?? 0) - (points[i - 2] ?? 0),
        (points[i + 1] ?? 0) - (points[i - 1] ?? 0),
      );
    }
    return host.stroke(points, { dur: Math.min(0.6, Math.max(0.08, length / 1400)), ...extra });
  };
  const keep = (drawn: Drawn): Drawn => {
    out.push(drawn);
    return drawn;
  };
  switch (k) {
    case 'callout': {
      const c = o as Spec<'callout'>;
      const [lx, ly] = c.from;
      const text = keep(
        host.write(c.label, {
          x: lx,
          y: ly,
          size: c.size,
          hand: 'scrawl',
          tool: c.highlight === 0 ? 'red' : tool,
          at: c.at,
        }),
      );
      const width = host.textWidth(c.label, c.size, 'scrawl');
      const sx = lx + (c.x > lx ? width + 6 : -6);
      const sy = ly - c.size * 0.4;
      keep(
        host.arrow(
          [
            sx,
            sy,
            (sx + c.x) / 2,
            (sy + c.y) / 2 - 14,
            c.x - Math.sign(c.x - sx) * (c.ring + 6),
            c.y,
          ],
          { tool: c.highlight === 0 ? 'red' : tool, at: text.end + 0.1 },
        ),
      );
      if (c.ring > 0) keep(host.loop(c.x, c.y, c.ring, c.ring * 0.85, { tool: 'red' }));
      break;
    }
    case 'timeline': {
      const c = o as Spec<'timeline'>;
      keep(
        rule([c.x, c.y, c.x + c.w * 0.5, c.y - 1, c.x + c.w, c.y + 1], { ...first, smooth: false }),
      );
      keep(host.arrow([c.x + c.w - 6, c.y + 1, c.x + c.w + 14, c.y], { tool, head: 9 }));
      c.events.forEach((event, i) => {
        const px = c.x + c.w * (event.pos ?? (i + 0.5) / c.events.length);
        const tick = keep(rule([px, c.y - 8, px + 1, c.y + 8], { tool, smooth: false }));
        const ly = c.y + 14 + c.size + (i % 2) * (c.size + 6);
        keep(
          write(event.label, px - host.textWidth(event.label, c.size) / 2, ly, i, { at: tick.at }),
        );
      });
      break;
    }
    case 'map': {
      const c = o as Spec<'map'>;
      const at = (u: number, v: number): [number, number] => [c.x + u * c.w, c.y + v * c.h];
      if (c.land !== 'none') {
        const coast: number[] = [];
        const island = c.land === 'island';
        const n = 14;
        for (let i = 0; i <= n; i += 1) {
          const a = (i / n) * Math.PI * 2;
          const r = 1 + 0.12 * Math.sin(3 * a + 1) + 0.08 * Math.sin(5 * a);
          coast.push(
            ...(island
              ? at(0.5 + Math.cos(a) * 0.42 * r, 0.5 + Math.sin(a) * 0.4 * r)
              : at(i / n, 0.35 + 0.18 * Math.sin(a * 0.5 + 1) * r)),
          );
        }
        keep(rule(coast, first));
        const area = island ? coast : [...coast, ...at(1, 1), ...at(0, 1)];
        keep(host.fill(area, { color: c.color, dur: 0.5 }));
      }
      if (c.route)
        keep(
          rule(
            c.route.flatMap(([u, v]) => at(u, v)),
            { tool: 'pencil', speed: 260 },
          ),
        );
      c.places.forEach((place, i) => {
        const [px, py] = at(...place.at);
        const ring = keep(host.loop(px, py, 4, 4, { tool, turns: 1.05 }));
        keep(write(place.label, px + 8, py - 6, i, { at: ring.at }));
      });
      if (c.compass) {
        const [cx, cy] = [c.x + c.w - 26, c.y + 30];
        keep(rule([cx, cy + 18, cx, cy - 18], { tool: 'fine', smooth: false }));
        keep(rule([cx - 14, cy, cx + 14, cy], { tool: 'fine', smooth: false }));
        keep(host.write('N', { x: cx - 5, y: cy - 22, size: 12, tool: 'fine', appear: 'pop' }));
      }
      if (c.mark) {
        const [mx, my] = at(...c.mark);
        keep(rule([mx - 10, my - 10, mx + 10, my + 10], { tool: 'red', smooth: false }));
        keep(rule([mx + 10, my - 10, mx - 10, my + 10], { tool: 'red', smooth: false }));
      }
      break;
    }
    case 'bars': {
      const c = o as Spec<'bars'>;
      keep(
        rule([c.x, c.y - c.h - 10, c.x - 1, c.y, c.x + c.w, c.y + 1], {
          ...first,
          corners: [1],
          smooth: false,
        }),
      );
      const top = Math.max(...c.bars.map((bar) => bar.value)) || 1;
      const slot = c.w / c.bars.length;
      c.bars.forEach((bar, i) => {
        const [bx, bw] = [c.x + slot * (i + 0.2), slot * 0.6];
        const bh = (bar.value / top) * c.h;
        const box = [bx, c.y, bx, c.y - bh, bx + bw, c.y - bh - 1, bx + bw, c.y];
        keep(rule(box, { tool, corners: [1, 2], smooth: false }));
        const filled = keep(
          host.fill(
            [
              bx + 2,
              c.y - 1,
              bx + 2,
              c.y - bh + 2,
              bx + bw - 2,
              c.y - bh + 2,
              bx + bw - 2,
              c.y - 1,
            ],
            { color: c.highlight === i ? 'red' : c.color, dur: 0.25 },
          ),
        );
        keep(
          write(
            bar.label,
            bx + bw / 2 - host.textWidth(bar.label, c.size) / 2,
            c.y + c.size + 8,
            i,
            { at: filled.at },
          ),
        );
        if (c.values)
          keep(
            write(
              String(bar.value),
              bx + bw / 2 - host.textWidth(String(bar.value), c.size) / 2,
              c.y - bh - 8,
              i,
            ),
          );
      });
      break;
    }
    case 'line': {
      const c = o as Spec<'line'>;
      keep(
        rule([c.x, c.y - c.h - 10, c.x - 1, c.y, c.x + c.w, c.y + 1], {
          ...first,
          corners: [1],
          smooth: false,
        }),
      );
      const lo = Math.min(...c.points);
      const hi = Math.max(...c.points);
      const pts = c.points.flatMap((value, i) => [
        c.x + 12 + ((c.w - 24) * i) / (c.points.length - 1),
        c.y - 8 - ((value - lo) / (hi - lo || 1)) * (c.h - 16),
      ]);
      keep(
        rule(pts, {
          tool: tool === 'felt' ? 'felt' : tool,
          corners: c.points.map((_, i) => i),
          smooth: false,
        }),
      );
      if (c.highlight !== undefined)
        keep(
          host.loop(pts[c.highlight * 2] ?? c.x, pts[c.highlight * 2 + 1] ?? c.y, 12, 10, {
            tool: 'red',
          }),
        );
      if (c.from) keep(write(c.from, c.x, c.y + c.size + 8, -1));
      if (c.to) keep(write(c.to, c.x + c.w - host.textWidth(c.to, c.size), c.y + c.size + 8, -2));
      break;
    }
    case 'pie': {
      const c = o as Spec<'pie'>;
      keep(rule(arcFlat(c.x, c.y, c.r, c.r * 0.98, -90, 285, 18), first));
      const total = c.slices.reduce((sum, slice) => sum + slice.value, 0);
      let angle = -90;
      c.slices.forEach((slice, i) => {
        const sweep = (slice.value / total) * 360;
        const edge = arcFlat(
          c.x,
          c.y,
          c.r - 3,
          c.r - 3,
          angle,
          angle + sweep,
          Math.max(2, Math.round(sweep / 20)),
        );
        const color =
          c.highlight === i ? 'red' : (slice.color ?? PALETTE[i % PALETTE.length] ?? 'orange');
        const wedge = keep(host.fill([c.x, c.y, ...edge], { color, dur: 0.3 }));
        const a = ((angle + sweep / 2) * Math.PI) / 180;
        keep(
          rule(
            [
              c.x,
              c.y,
              c.x + Math.cos((angle * Math.PI) / 180) * c.r,
              c.y + Math.sin((angle * Math.PI) / 180) * c.r,
            ],
            { tool, smooth: false },
          ),
        );
        const [lx, ly] = [c.x + Math.cos(a) * (c.r + 14), c.y + Math.sin(a) * (c.r + 14)];
        const sx = Math.cos(a) < 0 ? lx - host.textWidth(slice.label, c.size) : lx;
        keep(write(slice.label, sx, ly + c.size / 2, i, { at: wedge.at }));
        angle += sweep;
      });
      break;
    }
    case 'venn': {
      const c = o as Spec<'venn'>;
      const dx = c.r * 0.62;
      keep(host.loop(c.x - dx, c.y, c.r, c.r * 0.92, { ...first, turns: 1.05 }));
      keep(host.loop(c.x + dx, c.y, c.r, c.r * 0.92, { tool, turns: 1.05 }));
      keep(write(c.sets[0].label, c.x - dx - c.r * 0.7, c.y + c.size / 2, 0));
      keep(write(c.sets[1].label, c.x + dx + c.r * 0.15, c.y + c.size / 2, 1));
      if (c.both) keep(write(c.both, c.x - host.textWidth(c.both, c.size) / 2, c.y - c.r - 12, 2));
      break;
    }
    case 'flow': {
      const c = o as Spec<'flow'>;
      const n = c.steps.length;
      const right = c.direction === 'right';
      const step = right ? c.w / n : c.size * 3.4;
      c.steps.forEach((s, i) => {
        const width = host.textWidth(s.label, c.size) + 20;
        const [bx, by] = right ? [c.x + i * step, c.y] : [c.x, c.y + i * step];
        keep(
          rule(
            [
              bx,
              by,
              bx + width,
              by - 1,
              bx + width + 1,
              by + c.size + 14,
              bx - 1,
              by + c.size + 14,
              bx + 1,
              by - 2,
            ],
            { tool, at: i === 0 ? c.at : undefined, corners: [1, 2, 3], smooth: false },
          ),
        );
        keep(write(s.label, bx + 10, by + c.size + 6, i));
        if (i < n - 1) {
          const a = right
            ? [bx + width + 6, by + c.size / 2 + 7, c.x + (i + 1) * step - 6, by + c.size / 2 + 7]
            : [bx + 20, by + c.size + 18, bx + 22, by + step - 4];
          keep(host.arrow(a, { tool, head: 8 }));
        }
      });
      break;
    }
    case 'stack': {
      const c = o as Spec<'stack'>;
      const gap = c.gap ?? c.size * 2.1;
      c.items.forEach((entry, i) => {
        const y = c.y + i * gap;
        const b = c.x;
        const mark =
          c.bullet === 'check'
            ? [b, y - 8, b + 5, y - 2, b + 13, y - 16]
            : c.bullet === 'cross'
              ? [b, y - 14, b + 12, y - 2]
              : c.bullet === 'dash'
                ? [b, y - 7, b + 12, y - 8]
                : [b + 3, y - 8, b + 4, y - 7];
        const bulletTool = c.bullet === 'cross' ? 'red' : c.bullet === 'check' ? 'felt' : tool;
        const quiet = c.labels === 'appear' ? { appear: 'bloom' } : {};
        keep(
          rule(mark, {
            tool: bulletTool,
            width: c.bullet === 'dot' ? 5 : undefined,
            at: i === 0 ? c.at : undefined,
            smooth: false,
            ...quiet,
          }),
        );
        keep(write(entry.label, b + 24, y, i));
      });
      break;
    }
    case 'cutaway': {
      const c = o as Spec<'cutaway'>;
      const total = c.layers.reduce((sum, layer) => sum + layer.depth, 0);
      let y = c.y;
      keep(rule([c.x, c.y, c.x + c.w, c.y + 1], { ...first, smooth: false }));
      c.layers.forEach((layer, i) => {
        const lh = (layer.depth / total) * c.h;
        const wave = (yy: number) => [
          c.x,
          yy,
          c.x + c.w * 0.3,
          yy + 3,
          c.x + c.w * 0.7,
          yy - 3,
          c.x + c.w,
          yy,
        ];
        const band = keep(
          host.fill([...wave(y), c.x + c.w, y + lh, c.x, y + lh], {
            color: c.highlight === i ? 'red' : layer.color,
            dur: 0.22,
          }),
        );
        keep(write(layer.label, c.x + c.w + 12, y + lh / 2 + c.size / 2, i, { at: band.at }));
        keep(rule(wave(y + lh), { tool, smooth: true }));
        y += lh;
      });
      if (c.shape === 'box')
        keep(
          rule([c.x, c.y, c.x, c.y + c.h, c.x + c.w, c.y + c.h, c.x + c.w, c.y], {
            tool,
            corners: [1, 2],
            smooth: false,
          }),
        );
      break;
    }
  }
  const startAt = Math.min(...out.map((drawn) => drawn.at));
  return { at: startAt, end: Math.max(...out.map((drawn) => drawn.end)) };
}
