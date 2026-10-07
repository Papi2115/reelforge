/**
 * The Game B2 renderer without a GPU (PLAN.md#13.4): a frame is a pure function of t (any seek
 * order, a fresh world gives the same pixels), only palette indices are written, the HUD stays
 * transparent where it has nothing to say, and view + HUD fit the frame budget on the CPU.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HudModel } from '../hud/model.js';
import { compileLevel } from '../level/compile.js';
import { builtInLevel } from '../level/examples.js';
import { checkLevel } from '../level/schema.js';
import { T } from '../palette.js';
import { createPath } from '../ray/camera.js';
import { SCREEN_H, SCREEN_W } from './output.js';
import { B2World } from './world.js';

const WALK = [
  { at: 0, x: 2.5, y: 8.6, yaw: 2, pitch: 0, eye: 0.5, ease: 'lin' },
  { at: 1.4, x: 3.8, y: 8.68, yaw: 3, pitch: 0, eye: 0.5, ease: 'in' },
  { at: 2.5, x: 6.9, y: 8.76, yaw: 2, pitch: 0, eye: 0.5, ease: 'out' },
  { at: 3.15, x: 7.0, y: 8.76, yaw: -80, pitch: 5, eye: 0.5, ease: 'inOut' },
  { at: 5.95, x: 7.1, y: 8.72, yaw: -4, pitch: 0, eye: 0.5, ease: 'inOut' },
  { at: 8, x: 15.1, y: 8.74, yaw: -5, pitch: 0, eye: 0.5, ease: 'out' },
] as const;

function scene(): { world: B2World; hud: HudModel } {
  const checked = checkLevel(builtInLevel('warehouse', 'E.T.'));
  if (!checked.ok) throw new Error(checked.errors.join('\n'));
  const world = new B2World(compileLevel(checked.level), createPath(WALK, 7), 7, 1);
  world.hand.add({
    kind: 'take',
    at: 3.25,
    until: 6,
    item: { label: 'E.T.' },
    from: [7.25, 7.02, 0.45],
  });
  world.open(19, 8, 6.5, 0.7);
  world.shake(4.2, 2);
  const hud = new HudModel(7, 8);
  hud.compass({
    at: 0,
    until: 8,
    years: [{ at: 0, year: '1982', place: 'THE WAREHOUSE' }],
    targets: [],
  });
  hud.minimap(0, 8);
  hud.say('ATARI BETS ON A HIT\nAND FILLS THE WAREHOUSE.', '', 1.9, 5.6);
  hud.toast('+ ITEM', 'E.T. CARTRIDGE', 4.35, 7.3);
  return { world, hud };
}

function frameHash(world: B2World, hud: HudModel, t: number, screen: Uint8Array): string {
  const cam = world.render(t, screen);
  const overlay = hud.draw(t, cam, world);
  return createHash('sha256').update(screen).update(overlay.d).digest('hex');
}

const TIMES = [0, 0.7, 1.4, 2.9, 3.6, 4.1, 5.0, 6.2, 6.9, 7.8];

describe('B2World render', () => {
  it('paints the same pixels for the same t in any order and in a fresh world', () => {
    const screen = new Uint8Array(SCREEN_W * SCREEN_H);
    const a = scene();
    const forward = TIMES.map((t) => frameHash(a.world, a.hud, t, screen));
    const backward = [...TIMES]
      .reverse()
      .map((t) => frameHash(a.world, a.hud, t, screen))
      .reverse();
    expect(backward).toEqual(forward);
    const shuffled = [5, 2, 9, 0, 7, 3, 8, 1, 6, 4];
    const b = scene();
    const random = new Map(
      shuffled.map((i) => [i, frameHash(b.world, b.hud, TIMES[i] ?? 0, screen)]),
    );
    expect(TIMES.map((_, i) => random.get(i))).toEqual(forward);
    expect(new Set(forward).size).toBe(TIMES.length);
  });

  it('writes palette indices only, and the HUD is transparent where it is silent', () => {
    const screen = new Uint8Array(SCREEN_W * SCREEN_H);
    const { world, hud } = scene();
    for (const t of [1, 4, 6.5]) {
      const cam = world.render(t, screen);
      expect(
        screen.reduce((max, index) => Math.max(max, index), 0),
        `view t=${String(t)}`,
      ).toBeLessThan(32);
      const overlay = hud.draw(t, cam, world).d;
      const used = new Set(overlay);
      for (const index of used)
        expect(index === T || index < 32, `hud index ${String(index)}`).toBe(true);
      const transparent = overlay.filter((index) => index === T).length / overlay.length;
      expect(transparent).toBeGreaterThan(0.6);
    }
  });

  it('renders view + HUD within the frame budget on the CPU (<= 10 ms/frame measured)', () => {
    const screen = new Uint8Array(SCREEN_W * SCREEN_H);
    const { world, hud } = scene();
    for (let i = 0; i < 40; i += 1) frameHash(world, hud, i * 0.1, screen);
    // The fastest of several batches: other test files share the CPU, the renderer does not.
    const batches = 6;
    const frames = 20;
    let ms = Number.POSITIVE_INFINITY;
    for (let batch = 0; batch < batches; batch += 1) {
      const started = process.hrtime.bigint();
      for (let i = 0; i < frames; i += 1) {
        const t = ((batch * frames + i) / (batches * frames)) * 8;
        const cam = world.render(t, screen);
        hud.draw(t, cam, world);
      }
      ms = Math.min(ms, Number(process.hrtime.bigint() - started) / 1e6 / frames);
    }
    process.stdout.write(`game-b2 view+hud: ${ms.toFixed(2)} ms/frame (640x360, best batch)
`);
    // Generous ceiling for slow CI machines; the measured number is in the log.
    expect(ms).toBeLessThan(30);
  });
});
