/**
 * The game-over screen of look C (`screen.gameOver(spec)`, the showcase's shot 10 head): the
 * picture goes black, the boss card that won stays burned into the phosphor, CONTINUE? types in
 * the 2600 score kernel and a big gold digit counts down with unequal holds, each tick squashing
 * the digit and kicking a small shake; or GAME OVER slams in Box Art. A picture overlay.
 */
import { z } from 'zod';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { IndexCanvas } from '../core/canvas.js';
import { boxArt, score } from '../core/fonts.js';
import { shake, typed } from '../core/math.js';
import { C, GHOST, T } from '../palette.js';
import { drawBossCard, type BossSpec } from './boss-card.js';

export const gameOverSchema = z.strictObject({
  text: z.enum(['CONTINUE?', 'GAME OVER']).default('CONTINUE?'),
  at: whenParam,
  until: whenParam.optional(),
  count: z
    .array(z.tuple([whenParam, z.int().min(0).max(9)]))
    .max(4)
    .default([])
    .describe('[t, digit] countdown steps (unequal holds read as a machine waiting)'),
  ghost: z.boolean().default(true).describe('The boss card that won stays burned in'),
});

export interface GameOverPlan {
  readonly text: 'CONTINUE?' | 'GAME OVER';
  readonly at: number;
  readonly until: number;
  readonly count: readonly (readonly [number, number])[];
  readonly ghost: boolean;
  readonly seed: number;
}

/** The game-over overlay; `bosses` are the shot's boss cards (their burn-in). */
export function gameOverOverlay(plan: GameOverPlan, bosses: readonly BossSpec[]) {
  let burn: IndexCanvas | undefined;
  return (cv: IndexCanvas, t: number): void => {
    if (t < plan.at || t >= plan.until) return;
    cv.fill(C.VOID);
    if (plan.ghost && bosses.length > 0) {
      burn ??= new IndexCanvas(cv.w, cv.h);
      burn.fill(T);
      for (const boss of bosses) drawBossCard(burn, { ...boss, defeat: undefined }, boss.at + 20);
      for (let i = 0; i < burn.d.length; i += 1) {
        const v = burn.d[i] ?? T;
        if (v !== T && v !== C.VOID) cv.d[i] = GHOST[cv.d[i] ?? 0] ?? 0;
      }
    }
    if (plan.text === 'GAME OVER') {
      if (t >= plan.at + 0.15) {
        const sh = shake(t, plan.at + 0.15, 4, 10, plan.seed);
        boxArt(cv, 'GAME OVER', 64 + sh.x, 140 + sh.y, 6, {
          fill: C.CREAM,
          extrude: C.RUST,
          key: C.VOID,
        });
      }
    } else {
      const n = typed(plan.text, t, plan.at + 0.15, 88, 14);
      score(cv, plan.text.slice(0, n), 64, 150, 6, 5, C.CREAM);
    }
    let digit: number | undefined;
    let since = 0;
    for (const [at, d] of plan.count)
      if (t >= at) {
        digit = d;
        since = t - at;
      }
    if (digit === undefined) return;
    const squash = since < 0.067 ? 0.8 : 1;
    const h = Math.round(60 * squash);
    const sh = shake(t, t - since, 2, 12, 800 + digit);
    score(
      cv,
      String(digit),
      420 + sh.x,
      132 + (60 - h) + sh.y,
      14,
      Math.round(12 * squash),
      C.GOLD,
    );
  };
}

export function gameOverCues(plan: GameOverPlan): { t: number; name: string }[] {
  return [{ t: plan.at, name: 'blip-down' }, ...plan.count.map(([t]) => ({ t, name: 'tick' }))];
}
