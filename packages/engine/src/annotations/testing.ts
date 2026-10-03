/** Test helpers: a GL-free shot on a desk with a calculator, annotated by the test's update. */
import { createExactAnchorResolver, NO_ANCHORS, type AnchorResolver } from '../anchors.js';
import type { SceneContext } from '../contract.js';
import { buildShot, type BuiltShot } from '../shot.js';
import { resolveStyle } from '../style.js';
import { hexToRgb8 } from '../text/surface.js';

export const style = resolveStyle({});
export const WIDTH = 640;
export const HEIGHT = 360;

export interface DeskState {
  readonly desk: ReturnType<SceneContext['kit']['env']['desk']>;
  readonly calc: ReturnType<SceneContext['kit']['props']['calculator']>;
}

export const SPOKEN = createExactAnchorResolver([
  { text: 'Look', t: 0.5, tEnd: 0.8 },
  { text: 'at', t: 0.8, tEnd: 0.9 },
  { text: 'the', t: 0.9, tEnd: 1.0 },
  { text: 'keypad.', t: 1.0, tEnd: 1.5 },
]);

/** Camera pose of the desk shots: in front of and above the desk, looking at the calculator. */
export function deskCamera(ctx: SceneContext, x = 0): void {
  ctx.camera.set({ position: [x, 3.2, 4.2], target: [0, 1, 0], fov: 50 });
}

export function deskShot(
  update: (t: number, state: DeskState, ctx: SceneContext) => void,
  options: { readonly anchors?: AnchorResolver; readonly extra?: (ctx: SceneContext) => void } = {},
): BuiltShot {
  return buildShot({
    shot: { id: 'ann', t0: 0, duration: 4, width: WIDTH, height: HEIGHT, fps: 10 },
    module: {
      meta: { id: 'ann' },
      build: (ctx) => {
        const desk = ctx.kit.env.desk({ width: 4, drawers: false });
        const calc = ctx.kit.props.calculator({ scale: 1.4 }).on(desk);
        ctx.scene.add(desk);
        options.extra?.(ctx);
        return { desk, calc };
      },
      update: (t, state, ctx) => {
        update(t, state as DeskState, ctx);
      },
    },
    projectSeed: 7,
    palette: style.palette,
    resolveAnchor: options.anchors ?? NO_ANCHORS,
  });
}

/** Opaque overlay pixels. */
export function inkCount(shot: BuiltShot): number {
  let count = 0;
  for (let offset = 3; offset < shot.overlay.pixels.length; offset += 4) {
    if (shot.overlay.pixels[offset] === 255) count += 1;
  }
  return count;
}

/** Colours (`r,g,b`) of the opaque overlay pixels. */
export function inkColors(shot: BuiltShot): Set<string> {
  const colors = new Set<string>();
  const { pixels } = shot.overlay;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] === 255) colors.add([...pixels.subarray(offset, offset + 3)].join(','));
  }
  return colors;
}

export function paletteColors(): Set<string> {
  return new Set(Object.values(style.palette).map((hex) => hexToRgb8(hex).join(',')));
}
