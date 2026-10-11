/**
 * Test scene for the Grim Ink text render test (PLAN.md#14.18), run inside the page (served by
 * ccam-module-server.ts + ccam-zod-route.ts): a title card with a person line-up (the CC0
 * fallback lettering, so the golden is the same on every machine), the prototype caption over it
 * with the system font when the page has Arial Black (`systemFont`), and the contact sheet of a
 * person holding a prop through `held` / `arms`. Pure functions of their inputs.
 */
import { asPaint2D } from '../../src/worlds/c-cam/draw/paint.js';
import { personFromModule } from '../../src/worlds/c-cam/modules/person.js';
import { paintCaption } from '../../src/worlds/c-cam/text/captions.js';
import { inkFontReport } from '../../src/worlds/c-cam/text/roles.js';
import { titleCard } from '../../src/worlds/c-cam/text/title-card.js';

const FRAME = { width: 1920, height: 1080 };

/** The title card of a sample film at time t (fallback lettering), the baker twice in the cast. */
export function paintTitleCard(ctx: CanvasRenderingContext2D, namespace: unknown, t: number): void {
  const g = asPaint2D(ctx);
  const baker = personFromModule(namespace, 'kit-ext/people/nightBaker.js');
  titleCard(g, undefined, t, {
    title: 'What if you won your freedom?',
    subtitle: 'ROME · 80 AD',
    cast: [
      { person: baker, x: 560, y: 1110, s: 0.8, view: 1, expr: 'smug' },
      { person: baker, x: 1360, y: 1110, s: 0.8, view: -1, expr: 'scared', pose: 'akimbo' },
    ],
  });
}

/** True when the page's canvas has the caption role's font (the system-font path can run). */
export function hasCaptionFont(ctx: CanvasRenderingContext2D): boolean {
  return !inkFontReport(ctx).fallbackRoles.includes('caption');
}

/** The prototype caption on top of the title card, with the system font when present. */
export function paintSystemCaption(ctx: CanvasRenderingContext2D, namespace: unknown): void {
  paintTitleCard(ctx, namespace, 3);
  paintCaption(asPaint2D(ctx), ctx, 'So what do you do with freedom?', FRAME);
}

/** Sheet page 0 of a person holding a wooden sword in the left hand (`held` + `arms`). */
export function paintHeldSheet(ctx: CanvasRenderingContext2D, namespace: unknown): void {
  const base = (namespace as { person: Record<string, unknown> }).person;
  const person = personFromModule(
    {
      person: {
        ...base,
        id: 'swordsman',
        arms: (p: { sword?: boolean }) => (p.sword === false ? undefined : { L: { hand: 'grip' } }),
        held(
          _g: unknown,
          ink: { blob(pts: number[], fill: string, o?: unknown): unknown },
          side: string,
          palm: readonly number[],
          p: { sword?: boolean },
        ) {
          if (side !== 'L' || p.sword === false) return;
          const [x = 0, y = 0] = palm;
          ink.blob([x - 9, y - 26, x + 9, y - 26, x + 7, y + 150, x - 7, y + 150], '#a5714a', {
            seed: 7,
          });
        },
      },
    },
    'kit-ext/people/swordsman.js',
  );
  person.sheet(asPaint2D(ctx), 0);
}

/** The same caption in the CC0 fallback lettering (a machine without the font). */
export function fallbackCaption(ctx: CanvasRenderingContext2D): void {
  paintCaption(asPaint2D(ctx), undefined, 'So what do you do with freedom?', FRAME);
}
