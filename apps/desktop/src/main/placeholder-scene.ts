/**
 * Preview-only stand-in for a shot whose scene module is not built yet (hotfix 2.3.1): a dark card
 * with a thin frame showing the shot id, "not built yet", the shot's intent and its treatment,
 * drawn with palette tokens and the pixel fonts. The module is a pure function of the shot (and
 * of `t`, like every scene); export and render never use it (buildProjectManifest's
 * `previewPlaceholders` is set only by the preview).
 */
import type { StoryboardShot } from '@reelforge/shared';

/** Longer intents are cut so the card stays inside the frame. */
export const MAX_PLACEHOLDER_INTENT_CHARS = 180;

export type PlaceholderShot = Pick<StoryboardShot, 'id' | 't0' | 't1' | 'treatment' | 'intent'>;

/** Maps characters the pixel fonts lack (`_`, typographic quotes) to ones they draw. */
function printable(text: string): string {
  return text
    .replace(/_/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

function clipped(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
}

function literal(value: unknown): string {
  return JSON.stringify(value);
}

/** ES module source of the placeholder scene of `shot` (same shot, same text, byte for byte). */
export function placeholderSceneSource(shot: PlaceholderShot): string {
  const meta = { id: shot.id, title: `${shot.id} (not built yet)`, treatment: shot.treatment };
  const detail = `${shot.treatment} · ${(shot.t1 - shot.t0).toFixed(1)} s`;
  return `// ReelForge preview placeholder: this shot has no scene file yet. Never exported.
export const meta = ${literal(meta)};

const LABEL = ${literal(printable(shot.id))};
const INTENT = ${literal(clipped(printable(shot.intent), MAX_PLACEHOLDER_INTENT_CHARS))};
const DETAIL = ${literal(detail)};
const FOV = 50;
const DISTANCE = 10;
const STATIC = { enter: 'none', exit: 'none' };
const INTENT_WIDTH = 0.8;
const INTENT_LINES = 3;

function plane(three, width, height, color, z) {
  const geometry = new three.PlaneGeometry(width, height);
  const mesh = new three.Mesh(geometry, new three.MeshBasicMaterial({ color }));
  mesh.position.set(0, 0, z);
  return mesh;
}

export function build(ctx) {
  const { three, scene, palette, shot } = ctx;
  scene.background = new three.Color(palette.outline);
  ctx.camera.set({ position: [0, 0, DISTANCE], target: [0, 0, 0], fov: FOV });
  const height = 2 * DISTANCE * Math.tan((FOV * Math.PI) / 360);
  const width = (height * shot.width) / shot.height;
  const pixel = height / shot.height;
  const inset = 10 * pixel;
  const line = 2 * pixel;
  const frameWidth = width - 2 * inset;
  const frameHeight = height - 2 * inset;
  scene.add(plane(three, frameWidth, frameHeight, palette.textDim, 0));
  scene.add(plane(three, frameWidth - 2 * line, frameHeight - 2 * line, palette.outline, 0.01));
  return {};
}

export function update(t, state, ctx) {
  ctx.text.title(LABEL, {
    ...STATIC,
    id: 'placeholder-shot',
    pos: [0.5, 0.2],
    scale: 3,
    maxWidth: 0.84,
  });
  ctx.text.title('not built yet', {
    ...STATIC,
    id: 'placeholder-status',
    pos: [0.5, 0.33],
    color: 'accent1',
    scale: 2,
  });
  // Long intents drop to the small mono size so they never run into the detail line.
  const fits = ctx.text.measure(INTENT, { font: 'mono', scale: 2, maxWidth: INTENT_WIDTH });
  ctx.text.title(INTENT, {
    ...STATIC,
    id: 'placeholder-intent',
    pos: [0.5, 0.43],
    valign: 'top',
    font: 'mono',
    scale: fits.lines.length > INTENT_LINES ? 1 : 2,
    maxWidth: INTENT_WIDTH,
  });
  ctx.text.title(DETAIL, {
    ...STATIC,
    id: 'placeholder-detail',
    pos: [0.5, 0.86],
    font: 'mono',
    scale: 2,
    color: 'textDim',
  });
}
`;
}
