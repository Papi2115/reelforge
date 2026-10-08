/**
 * Panel layout by beats (PLAN.md#13.15a; real run Comic 1 used the presets 0/13 times and opened
 * five pages on empty ruled panels). `suggestLayout(weights)` picks a preset and its split
 * weights from how many beats a page has and how much each matters (panel size = importance; a
 * dominant beat gets the big panel, mirrored when it comes last). `page.layout(beats)` builds the
 * panels in beat order, each entering on its beat with its establishing backdrop already drawn,
 * so a panel is never an empty ruled box.
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { panelModelOf, parse, type ApiContext, type PanelHandle } from '../page/api.js';
import type { LayoutName } from '../page/layouts.js';
import type { Painter } from '../page/panel.js';
import type { ComicPen } from '../page/pen.js';

export interface LayoutSuggestion {
  readonly layout: LayoutName;
  readonly weights: number[];
  readonly mirror: boolean;
  /** Panel index (preset order) of each beat. */
  readonly order: number[];
  /** Why this preset (for the scene comment). */
  readonly why: string;
}

const clampW = (value: number) => Math.min(0.75, Math.max(0.25, value));

/** A preset for 1-4 beats of the given importance (any positive numbers; 1 = normal, 2 = big). */
export function suggestLayout(weights: readonly number[]): LayoutSuggestion {
  const n = weights.length;
  if (n === 0 || n > 4 || weights.some((w) => !(w > 0))) {
    throw new KitError(
      'invalid-params',
      `suggestLayout: 1-4 beats with positive weights (got ${String(n)}); more beats = a second page or panel() quads`,
    );
  }
  const total = weights.reduce((a, b) => a + b, 0);
  const share = weights.map((w) => w / total);
  const top = Math.max(...weights);
  const big = weights.indexOf(top);
  const dominant = weights.every((w, i) => i === big || top >= w * 1.6);
  const last = big === n - 1 && n > 1;
  if (n === 1)
    return { layout: 'splash', weights: [], mirror: false, order: [0], why: 'one beat: a splash' };
  if (n === 2) {
    if (top >= Math.min(...weights) * 2.5) {
      return {
        layout: 'splash-inset',
        weights: [0.3, 0.38],
        mirror: false,
        order: big === 0 ? [0, 1] : [1, 0],
        why: 'one beat dominates: a splash with an inset breaking the frame',
      };
    }
    return {
      layout: '2-up',
      weights: [clampW(share[0] ?? 0.5)],
      mirror: false,
      order: [0, 1],
      why: 'two beats side by side, sized by importance',
    };
  }
  if (n === 3) {
    if (dominant && big !== 1) {
      const rest = weights.filter((_, i) => i !== big);
      const rows = clampW((rest[0] ?? 1) / ((rest[0] ?? 1) + (rest[1] ?? 1)));
      const order = last ? [1, 2, 0] : [0, 1, 2];
      return {
        layout: '3-up-l',
        weights: [clampW(0.3 + (share[big] ?? 0.4) * 0.5), rows],
        mirror: last,
        order,
        why: 'a dominant beat gets the tall panel, the others stack beside it',
      };
    }
    const s0 = share[0] ?? 0.33;
    const s1 = share[1] ?? 0.33;
    return {
      layout: 'strip',
      weights: [Math.max(0.2, Math.min(0.6, s0)), Math.max(0.4, Math.min(0.8, s0 + s1))],
      mirror: false,
      order: [0, 1, 2],
      why: 'three beats in a strip, column widths by importance',
    };
  }
  if (dominant && (big === 0 || last)) {
    const order = last ? [1, 2, 3, 0] : [0, 1, 2, 3];
    return {
      layout: '4-l',
      weights: [clampW(0.25 + (share[big] ?? 0.4) * 0.5), 0.42, 0.45],
      mirror: last,
      order,
      why: 'a dominant beat gets the tall panel, a wide and two small panels beside it',
    };
  }
  const left = clampW((share[0] ?? 0.25) + (share[2] ?? 0.25));
  const rowsL = clampW((share[0] ?? 0.25) / ((share[0] ?? 0.25) + (share[2] ?? 0.25)));
  const rowsR = clampW((share[1] ?? 0.25) / ((share[1] ?? 0.25) + (share[3] ?? 0.25)));
  return {
    layout: '4-grid',
    weights: [left, rowsL, Math.abs(rowsR - rowsL) < 0.06 ? rowsL + 0.1 : rowsR],
    mirror: false,
    order: [0, 1, 2, 3],
    why: 'four beats in an uneven grid',
  };
}

const painterSchema = z.custom<Painter>((value) => typeof value === 'function', {
  message: 'draw is a function (g, t) => ...',
});

export const beatSchema = z.strictObject({
  at: whenParam.optional().describe('When the panel enters (seconds or a phrase); default 0'),
  weight: z.number().positive().max(10).default(1).describe('Importance: 1 normal, 2 big'),
  draw: painterSchema.optional(),
  backdrop: z
    .union([z.string().min(1), z.record(z.string(), z.unknown())])
    .optional()
    .describe('Establishing backdrop: a preset name, a defined id or backdrop options'),
  enter: z.enum(['cut', 'slam', 'slide', 'pop']).optional(),
});

export const layoutPageSchema = z.strictObject({
  backdrop: beatSchema.shape.backdrop,
  layout: z.string().optional().describe('Override the suggested preset'),
  mirror: z.boolean().optional(),
  gutter: z.number().min(3).max(30).optional(),
  seed: z.int().min(0).optional(),
  reveal: z
    .enum(['page', 'beats'])
    .default('page')
    .describe(
      "'page': every panel shows its establishing backdrop from the start, each subject arrives on its beat; 'beats': panels enter on their beats over their pencil roughs",
    ),
});

/** Prepares (and validates) an establishing backdrop for a panel's box; returns its painter. */
export type BackdropPainter = (
  backdrop: string | Readonly<Record<string, unknown>>,
  box: readonly [number, number, number, number],
) => (g: ComicPen) => void;

export function createLayout(
  ctx: ApiContext,
  panels: (
    layout: LayoutName,
    options: { weights: number[]; mirror: boolean; gutter?: number; seed?: number },
  ) => PanelHandle[],
  paintBackdrop: BackdropPainter,
) {
  return (beats: readonly unknown[], options?: unknown): PanelHandle[] => {
    const where = `${ctx.call}.layout`;
    const list = beats.map((beat, i) => parse(beatSchema, beat, `${where} beat ${String(i + 1)}`));
    const o = parse(layoutPageSchema, options ?? {}, where);
    const suggestion = suggestLayout(list.map((beat) => beat.weight));
    const layout = (o.layout ?? suggestion.layout) as LayoutName;
    const made = panels(layout, {
      weights: o.layout === undefined ? suggestion.weights : [],
      mirror: o.mirror ?? suggestion.mirror,
      ...(o.gutter === undefined ? {} : { gutter: o.gutter }),
      ...(o.seed === undefined ? {} : { seed: o.seed }),
    });
    if (made.length !== list.length) {
      throw new KitError(
        'invalid-params',
        `${where}: layout '${layout}' has ${String(made.length)} panels for ${String(list.length)} beats`,
      );
    }
    return list.map((beat, i) => {
      const panel = made[o.layout === undefined ? (suggestion.order[i] ?? i) : i];
      if (panel === undefined)
        throw new KitError('invalid-params', `${where}: no panel for beat ${String(i + 1)}`);
      const backdrop = beat.backdrop ?? o.backdrop;
      if (backdrop === undefined && beat.draw === undefined) {
        // Painted later with panel.draw(...)? Checked on the first frame, when the page is known.
        const model = panelModelOf(panel);
        ctx.model.checks.push((call) => {
          if (model !== undefined && model.painters.length === 0) {
            throw new KitError(
              'invalid-params',
              `${call}.layout beat ${String(i + 1)}: nothing to draw - give it draw, a backdrop or panel.draw(...) (a panel is never an empty ruled box)`,
            );
          }
        });
      }
      if (backdrop !== undefined) panel.draw(paintBackdrop(backdrop, panel.box));
      const at = beat.at ?? 0;
      if (o.reveal === 'page' && backdrop !== undefined) {
        // The page is whole from the first frame: the panel's subject (this beat's painter and
        // every one the scene adds later) arrives on the beat, over the backdrop.
        const from = ctx.resolve(at, 0);
        const draw = panel.draw.bind(panel);
        panel.draw = (painter) =>
          draw((g, t) => {
            if (t >= from) painter(g, t);
          });
        panel.enter({ at: 0 });
      } else {
        panel.enter({ at, kind: beat.enter ?? (i === 0 ? 'cut' : 'pop'), rough: i > 0 });
      }
      if (beat.draw !== undefined) panel.draw(beat.draw);
      return panel;
    });
  };
}
