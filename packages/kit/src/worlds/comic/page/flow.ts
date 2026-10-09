/**
 * Page flow and continuity of the Comic page (Papi after real run Comic 2: "it does not always
 * FEEL like a comic"; the mockup's pages unfold in different directions, its strips are long or
 * narrow, its things are carried across several panels). Two tools, each with a required
 * `intent` (why the page reads this way / what the carried thing means):
 * - `page.flow(spec)`: 2-5 panels laid out as a strip that runs ACROSS (a long band read
 *   sideways), DOWN (a tall narrow column read downward) or DIAGONAL (a stair), longer than the
 *   page if it must; the page camera reads it like an eye (hold, travel to the next panel just
 *   before its beat, hold). Panel size follows the beat's weight; gutters lean, never a grid.
 * - `page.thread(spec)`: one element (a rope, a road, a river, a colour band, a gesture, a thing in
 *   flight) drawn in page space OVER three or more panels and the gutters between them, so it is
 *   carried from panel to panel.
 * Portrait shorts (PLAN.md#13.18, a 360x640 page): `down` is the native flow (and the default
 * direction), a webtoon column read with the thumb; the camera brings each panel's foot to 80 %
 * of the frame height (the player covers the bottom fifth); `across` is a band at mid-height and
 * `diagonal` steps down the page. Pure functions of t.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { rndRange } from '../draw/math.js';
import { isPortraitPage, LANDSCAPE_PAGE, type PageSize } from '../style.js';
import { createHandle, panelModelOf, parse, type ApiContext, type PanelHandle } from './api.js';
import type { Quad } from './layouts.js';
import { misFor, PanelModel, type Painter } from './panel.js';
import { ComicPen } from './pen.js';

export const FLOW_DIRECTIONS = ['across', 'down', 'diagonal'] as const;
export type FlowDirection = (typeof FLOW_DIRECTIONS)[number];

type FlowPainter = (g: ComicPen, t: number, size: readonly [number, number]) => void;

const intent = (what: string) =>
  z.string().trim().min(12, `intent is required: ${what} (one sentence)`).max(240);

const flowBeat = z.strictObject({
  at: whenParam.default(0).describe('The camera arrives at this panel (its words land)'),
  weight: z.number().min(0.4).max(3).default(1).describe('Panel length along the flow'),
  draw: z.custom<FlowPainter>((value) => typeof value === 'function', {
    message: 'draw must be a painter (g, t, [w, h]) => { ... } in panel-local px',
  }),
});

export const flowSchema = z.strictObject({
  intent: intent('why the page reads in this direction (what the reading path means)'),
  direction: z
    .enum(FLOW_DIRECTIONS)
    .optional()
    .describe("Required on a landscape page; a portrait page reads 'down' by default"),
  beats: z.array(flowBeat).min(2, 'a flow is 2-5 panels').max(5, 'a flow is 2-5 panels'),
  breadth: z
    .number()
    .min(100)
    .max(600)
    .optional()
    .describe('Strip width across the flow (across: band height, down: column width)'),
  gutter: z.number().min(4).max(30).default(12),
  travel: z.number().min(0.15).max(1.5).default(0.4).describe('Seconds the eye travels'),
  camera: z
    .enum(['read', 'still'])
    .default('read')
    .describe("'read' = the page camera follows the strip; 'still' = it fits the page"),
  reveal: z
    .enum(['page', 'beats'])
    .default('page')
    .describe(
      "'page' = the whole strip is printed from the start and the camera reads it; 'beats' = each panel is inked when the eye sets off for it",
    ),
  seed: z.int().min(0).optional(),
});

export const threadSchema = z.strictObject({
  intent: intent('what the carried element means across the panels'),
  through: z.array(z.unknown()).min(3, 'a thread crosses at least 3 panels').max(5),
  draw: z.custom<Painter>((value) => typeof value === 'function', {
    message: 'draw must be a painter (g, t) => { ... } in page px',
  }),
  at: whenParam.optional(),
  until: whenParam.optional(),
});

type Box = [number, number, number, number];

/** Panel boxes along the flow (page px, may run past the page) and the camera centre per panel. */
export function flowBoxes(
  direction: FlowDirection,
  weights: readonly number[],
  breadth: number | undefined,
  gutter: number,
  page: PageSize = LANDSCAPE_PAGE,
): { boxes: Box[]; centres: [number, number][] } {
  if (isPortraitPage(page)) return portraitFlowBoxes(direction, weights, breadth, gutter, page);
  const boxes: Box[] = [];
  let [x, y] = [24, 24];
  weights.forEach((weight, i) => {
    if (direction === 'across') {
      const h = breadth ?? 230;
      const w = Math.min(460, Math.max(130, 210 * weight));
      boxes.push([x, 180 - h / 2 + (i % 2 === 0 ? -4 : 5), w, h]);
      x += w + gutter;
    } else if (direction === 'down') {
      const w = breadth ?? 400;
      const h = Math.min(330, Math.max(90, 150 * weight));
      boxes.push([92 + (i % 2 === 0 ? 0 : 14), y, w, h]);
      y += h + gutter;
    } else {
      const w = Math.min(400, Math.max(150, (breadth ?? 250) * weight));
      const h = Math.min(300, Math.max(100, 160 * weight));
      boxes.push([x, y, w, h]);
      x += w + gutter;
      y += h * 0.55 + gutter;
    }
  });
  const centres = boxes.map(([bx, by, bw, bh]): [number, number] => [
    Math.max(320, bx + bw + 20 - 320),
    Math.max(180, by + bh + 16 - 180),
  ]);
  return { boxes, centres };
}

/** The flow on a portrait page: a column down the phone, a band at mid-height or a stair. */
function portraitFlowBoxes(
  direction: FlowDirection,
  weights: readonly number[],
  breadth: number | undefined,
  gutter: number,
  { width: W, height: H }: PageSize,
): { boxes: Box[]; centres: [number, number][] } {
  const boxes: Box[] = [];
  const across = Math.min(breadth ?? 300, W - 40);
  let [x, y] = [24, 48];
  weights.forEach((weight, i) => {
    if (direction === 'across') {
      const h = Math.min(breadth ?? 300, H * 0.6);
      const w = Math.min(300, Math.max(130, 210 * weight));
      boxes.push([x, H / 2 - h / 2 + (i % 2 === 0 ? -4 : 5), w, h]);
      x += w + gutter;
    } else if (direction === 'down') {
      const h = Math.min(H * 0.62, Math.max(150, 230 * weight));
      boxes.push([(W - across) / 2 + (i % 2 === 0 ? -8 : 8), y, across, h]);
      y += h + gutter;
    } else {
      const w = Math.min(W - 60, Math.max(150, (breadth ?? 220) * weight));
      const h = Math.min(300, Math.max(120, 170 * weight));
      const step = weights.length > 1 ? (W - 40 - w) / (weights.length - 1) : 0;
      boxes.push([20 + step * i, y, w, h]);
      y += h * 0.7 + gutter;
    }
  });
  // The panel's far end lands at 80 % of the frame (the Shorts player covers the bottom fifth).
  const centres = boxes.map(([bx, by, bw, bh]): [number, number] => [
    Math.max(W / 2, bx + bw + 20 - W / 2),
    Math.max(H / 2, by + bh + 16 - H * 0.3),
  ]);
  return { boxes, centres };
}

function quadOf([x, y, w, h]: Box, key: string): Quad {
  const n = (i: number) => Math.round(rndRange(key, i, -3, 3));
  return [
    x + n(0),
    y + n(1),
    x + w + n(2),
    y + n(3),
    x + w + n(4),
    y + h + n(5),
    x + n(6),
    y + h + n(7),
  ];
}

export function createFlowApi(ctx: ApiContext) {
  const { model, call } = ctx;
  return {
    flow(spec: z.input<typeof flowSchema>): { panels: PanelHandle[]; boxes: Box[] } {
      const where = `${call}.flow`;
      const o = parse(flowSchema, spec, where);
      const times = o.beats.map((beat) => ctx.resolve(beat.at, 0));
      times.forEach((t, i) => {
        if (i > 0 && t < (times[i - 1] ?? 0) + o.travel) {
          throw new KitError(
            'invalid-params',
            `${where}: beat ${String(i + 1)} lands at ${t.toFixed(2)} s; beats follow the reading order, each >= travel (${String(o.travel)} s) after the one before`,
          );
        }
      });
      const portrait = isPortraitPage(model.page);
      const direction = o.direction ?? (portrait ? 'down' : undefined);
      if (direction === undefined) {
        throw new KitError(
          'invalid-params',
          `${where}: direction: ${FLOW_DIRECTIONS.map((name) => `'${name}'`).join(' | ')} is required (a portrait page reads 'down' by default)`,
        );
      }
      const weights = o.beats.map((beat) => beat.weight);
      const { boxes, centres } = flowBoxes(direction, weights, o.breadth, o.gutter, model.page);
      const seed = o.seed ?? ctx.seed;
      const panels = o.beats.map((beat, i) => {
        const box = boxes[i] as Box;
        const key = `flow${String(seed)}-${String(i)}`;
        const style = { key, border: 2, boil: 0.5, pencils: true, mis: misFor(key) };
        const panel = new PanelModel(quadOf(box, key), style, model.panels.length, model.page);
        model.panels.push(panel);
        const handle = createHandle(ctx, panel, `${where} panel ${String(i + 1)}`);
        const size = [box[2], box[3]] as const;
        handle.draw((g, t) => {
          beat.draw(g.at(box[0], box[1]), t, size);
        });
        const enter = o.reveal === 'page' || i === 0 ? 0 : (times[i] ?? 0) - o.travel;
        handle.enter({ at: enter, kind: 'cut', rough: enter > 0 });
        return handle;
      });
      if (o.camera === 'read') {
        // Hold on a panel, travel to the next one just before its words land, hold again.
        const key = (at: number, [x, y]: readonly [number, number]) => ({
          at,
          x,
          y,
          zoom: 1,
          ease: 'inOutCubic' as const,
        });
        model.cameraKeys = centres.flatMap((centre, i) => {
          const t = times[i] ?? 0;
          const before = centres[i - 1];
          return before === undefined
            ? [key(0, centre)]
            : [key(t - o.travel, before), key(t, centre)];
        });
      }
      return { panels, boxes };
    },

    thread(spec: z.input<typeof threadSchema>): void {
      const where = `${call}.thread`;
      const o = parse(threadSchema, spec, where);
      const models = o.through.map((panel) => panelModelOf(panel));
      if (models.some((panel) => panel === undefined) || new Set(models).size !== models.length) {
        throw new KitError(
          'invalid-params',
          `${where}: through = 3-5 different panel handles the element crosses (from page.panels, page.layout, page.flow)`,
        );
      }
      const at = ctx.resolve(o.at, Number.NEGATIVE_INFINITY);
      const until = ctx.resolve(o.until, Number.POSITIVE_INFINITY);
      model.items.push({
        at,
        until,
        layer: 'over',
        draw: (item) => {
          o.draw(new ComicPen(item, item.page, model.mis, item.t), item.t);
        },
      });
    },
  };
}
