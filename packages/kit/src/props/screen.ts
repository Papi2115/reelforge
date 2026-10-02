/**
 * PixelScreen: the palette-limited pixel display of calculators, laptops, monitors and phones.
 * A pixel panel painted from the pure screen-content functions; the scene sets mode/text/glitch/
 * power and calls update(t) every frame, and the picture is a function of that state.
 */
import type * as THREE from 'three';
import { KitError } from '../errors.js';
import type { KitTools } from '../registry.js';
import type { VoxelColor } from '../voxel/model.js';
import type { TextAlign } from './font.js';
import { createPixelPanel } from './pixel-panel.js';
import {
  isAnimated,
  paintScreen,
  ROLE,
  SCREEN_MODES,
  type ScreenMode,
  type ScreenState,
} from './screen-content.js';
import { amountArg, finiteArg, pick, SCREEN_BACK, SCREEN_DIM, SCREEN_OFF } from './shared.js';

/** Style colours of the six screen roles. */
export type ScreenColors = Readonly<Record<keyof typeof ROLE, VoxelColor>>;

/** Scene-facing screen API (`calculator.screen`, `laptop.screen`, ...). */
export interface PixelScreen {
  /** Pixel resolution of the screen. */
  readonly width: number;
  readonly height: number;
  /** The modes this screen accepts. */
  readonly modes: readonly ScreenMode[];
  setMode(mode: ScreenMode): void;
  /** Text of the 'text' and 'glitch' modes ('\n' = new line; A-Z 0-9 and . , : - + = % $ / ! ?). */
  setText(text: string): void;
  /** Glitch overlay 0..1 on any mode (0 = clean); set it every frame, like a pose. */
  glitch(amount: number): void;
  /** Screen on/off (true/false or 0..1; off shows the dark panel). */
  power(on: boolean | number): void;
  /** Time of the animated modes (doom, code, chart, glitch); call it every frame. */
  update(t: number): void;
  /** Colour role (0 off, 1 back, 2 ink, 3 hot, 4 cool, 5 dim) of pixel (x, y) from the top-left. */
  roleAt(x: number, y: number): number;
}

export interface ScreenSpec {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly pixelSize: number;
  readonly colors: ScreenColors;
  readonly mode: ScreenMode;
  readonly text: string;
  readonly align: TextAlign;
  readonly seed: number;
  readonly modes?: readonly ScreenMode[] | undefined;
}

/** Display colours (laptop, monitor, phone): dark blue panel, cream text, hero/accent highlights. */
export function displayColors(tools: KitTools): ScreenColors {
  return {
    off: pick(tools, undefined, SCREEN_OFF),
    back: pick(tools, undefined, SCREEN_BACK),
    ink: 'text',
    hot: 'hero',
    cool: 'accent1',
    dim: pick(tools, undefined, SCREEN_DIM),
  };
}

export function createPixelScreen(
  tools: KitTools,
  spec: ScreenSpec,
): { readonly screen: PixelScreen; readonly mesh: THREE.Mesh } {
  const { width, height } = spec;
  const cells: (readonly [number, number])[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) cells.push([x, height - 1 - y]);
  }
  const roles = Object.keys(ROLE) as (keyof typeof ROLE)[];
  const panel = createPixelPanel(tools, {
    name: spec.name,
    cells,
    pixelSize: spec.pixelSize,
    colors: roles.map((role) => spec.colors[role]),
    offset: [-width / 2, -height / 2],
  });
  const modes = spec.modes ?? SCREEN_MODES;
  let state: ScreenState = {
    mode: spec.mode,
    text: spec.text,
    align: spec.align,
    glitch: 0,
    on: true,
    t: 0,
    seed: spec.seed,
  };
  let pixels: Uint8Array = new Uint8Array(width * height);
  const repaint = (next: ScreenState): void => {
    state = next;
    pixels = paintScreen(width, height, state);
    panel.paint(pixels);
  };
  repaint(state);
  const screen: PixelScreen = {
    width,
    height,
    modes,
    setMode(mode) {
      if (!modes.includes(mode)) {
        throw new KitError(
          'invalid-params',
          `${spec.name}.setMode(${JSON.stringify(mode)}): unknown mode (available: ${modes.join(', ')})`,
        );
      }
      if (mode !== state.mode) repaint({ ...state, mode });
    },
    setText(text) {
      // Scenes are untyped JS: numbers (e.g. a counter value) are shown as text.
      const input: unknown = text;
      const value = typeof input === 'string' ? input : String(input);
      if (value !== state.text) repaint({ ...state, text: value });
    },
    glitch(amount) {
      const value = amountArg(`${spec.name}.glitch(amount)`, amount);
      if (value !== state.glitch) repaint({ ...state, glitch: value });
    },
    power(on) {
      const value = amountArg(`${spec.name}.power(on)`, on) >= 0.5;
      if (value !== state.on) repaint({ ...state, on: value });
    },
    update(t) {
      const time = finiteArg(`${spec.name}.update(t)`, t);
      if (time === state.t) return;
      if (isAnimated(state)) repaint({ ...state, t: time });
      else state = { ...state, t: time };
    },
    roleAt(x, y) {
      return pixels[y * width + x] ?? ROLE.off;
    },
  };
  return { screen, mesh: panel.mesh };
}
