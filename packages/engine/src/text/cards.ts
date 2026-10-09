/**
 * The three card kinds (title, lower third, kinetic text): rest geometry (for QA), and drawing at
 * the current t with their enter/exit or per-word animation. Pure functions of (t, options).
 */
import { cardTransform, jitter, SHAKE_RATE, type CardTransform } from './animate.js';
import {
  drawBlock,
  glyphCount,
  placeBlock,
  shadowOffset,
  uniformLooks,
  withShadow,
  type Shadow,
  type WordLook,
} from './draw.js';
import type { BitmapFont } from './font.js';
import { DISPLAY_FONT } from './font-display.js';
import { MONO_FONT } from './font-mono.js';
import { blockSize, inkBox, layoutText, tokenInkBoxes, type TextLayout } from './layout.js';
import type {
  KineticWord,
  ParsedKineticOptions,
  ParsedLowerThirdOptions,
  ParsedTitleOptions,
  TitleAnimation,
} from './options.js';
import type { Paint, Rgb8, TextSurface } from './surface.js';
import type { FontName, PixelRect } from './types.js';

export interface CardEnv {
  readonly surface: TextSurface;
  readonly width: number;
  readonly height: number;
  readonly safeArea: PixelRect;
  readonly t: number;
  /** Seed of this card (shake jitter). */
  readonly seed: number;
  /** Resolves a palette token / swatch name; throws naming `option` when it is unknown. */
  color(name: string, option: string): Rgb8;
}

export interface CardResult {
  readonly box: PixelRect;
  readonly at: number;
  readonly until: number;
  readonly visible: boolean;
  /** Rest ink box of every word (titles, kinetic text). */
  readonly words?: readonly PixelRect[];
}

/** Lower third: plate padding, accent bar width and gap above the secondary line (pixels). */
const PLATE_PAD_X = 6;
const PLATE_PAD_Y = 4;
const ACCENT_BAR = 3;
const SECONDARY_GAP = 2;
/** Kinetic word animations (seconds). */
const POP_STEP = 0.06;
const WORD_SHAKE = 0.3;
const WORD_SHAKE_PIXELS = 3;
const TYPE_CHAR_DELAY = 0.05;

export function fontByName(name: FontName): BitmapFont {
  return name === 'mono' ? MONO_FONT : DISPLAY_FONT;
}

/**
 * Short edge of the frame: default text and stroke sizes follow it, so a portrait frame (360x640)
 * gets the same sizes as a landscape one (640x360).
 */
export function shortEdge(size: { readonly width: number; readonly height: number }): number {
  return Math.min(size.width, size.height);
}

/** Default integer scale of titles and kinetic text (3 at a 360 px short edge). */
export function defaultTitleScale(height: number): number {
  return Math.max(1, Math.round(height / 120));
}

/** Default scale of the lower-third primary line (2 at a 360 px short edge). */
export function defaultLowerThirdScale(height: number): number {
  return Math.max(1, Math.round(height / 180));
}

function defaultEnterDuration(enter: TitleAnimation, glyphs: number): number {
  return enter === 'typewriter' ? Math.min(2, Math.max(0.3, glyphs * 0.04)) : 0.4;
}

function maxUnits(pixels: number, scale: number): number {
  return Math.max(1, Math.floor(pixels / scale));
}

function paintFor(transform: CardTransform, box: PixelRect, height: number): Paint {
  if (transform.wipe >= 1) return { opacity: transform.opacity };
  const clip = { x: box.x + transform.dx, y: 0, w: Math.round(box.w * transform.wipe), h: height };
  return { opacity: transform.opacity, clip };
}

function union(first: PixelRect, second: PixelRect): PixelRect {
  if (second.w === 0 || second.h === 0) return first;
  if (first.w === 0 || first.h === 0) return second;
  const x = Math.min(first.x, second.x);
  const y = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.w, second.x + second.w);
  const bottom = Math.max(first.y + first.h, second.y + second.h);
  return { x, y, w: right - x, h: bottom - y };
}

export function renderTitle(env: CardEnv, text: string, options: ParsedTitleOptions): CardResult {
  const font = fontByName(options.font);
  const scale = options.scale ?? defaultTitleScale(shortEdge(env));
  const maxPixels = options.maxWidth === undefined ? env.safeArea.w : options.maxWidth * env.width;
  const layout = layoutText(font.normalize(text), font, maxUnits(maxPixels, scale));
  const color = env.color(options.color, 'color');
  const shadowColor = options.shadow === false ? undefined : env.color(options.shadow, 'shadow');
  const shadow = shadowColor && { color: shadowColor, offset: shadowOffset(scale) };
  const rest = placeBlock(layout, scale, options, env);
  const box = withShadow(inkBox(layout, options.align, scale, rest.left, rest.top), shadow);
  const until = options.until ?? Infinity;
  const glyphs = glyphCount(layout);
  const timing = {
    at: options.at,
    until,
    enter: options.enter,
    exit: options.exit,
    enterDuration: options.enterDuration ?? defaultEnterDuration(options.enter, glyphs),
    exitDuration: options.exitDuration,
  };
  const transform = cardTransform(env.t, timing, { ...env, scale });
  const words = tokenInkBoxes(layout, options.align, scale, rest.left, rest.top);
  const result = { box, at: options.at, until, visible: transform.visible, words };
  if (!transform.visible || transform.scale < 1) return result;
  const drawScale = transform.scale;
  const place = drawScale === scale ? rest : placeBlock(layout, drawScale, options, env);
  const looks = uniformLooks(
    layout,
    { dx: transform.dx, dy: transform.dy, scale: drawScale, color },
    Math.floor(transform.reveal * glyphs),
  );
  const drawShadow = shadowColor && { color: shadowColor, offset: shadowOffset(drawScale) };
  const block = { layout, align: options.align, scale: drawScale, ...place };
  drawBlock(env.surface, block, looks, paintFor(transform, box, env.height), drawShadow);
  return result;
}

interface LowerThirdGeometry {
  readonly primary: TextLayout;
  readonly secondary: TextLayout | undefined;
  readonly scale: number;
  /** Offset that moves the content (laid out at the origin) onto the plate. */
  readonly shiftX: number;
  readonly shiftY: number;
  readonly secondaryTop: number;
  readonly plate: PixelRect;
  readonly bar: PixelRect;
}

function lowerThirdGeometry(
  env: CardEnv,
  primary: string,
  secondary: string,
  options: ParsedLowerThirdOptions,
): LowerThirdGeometry {
  const scale = options.scale ?? defaultLowerThirdScale(shortEdge(env));
  const textWidth = Math.max(
    1,
    Math.round(options.maxWidth * env.width) - ACCENT_BAR - 2 * PLATE_PAD_X,
  );
  const primaryLayout = layoutText(
    DISPLAY_FONT.normalize(primary),
    DISPLAY_FONT,
    maxUnits(textWidth, scale),
  );
  const secondaryLayout =
    secondary === '' ? undefined : layoutText(MONO_FONT.normalize(secondary), MONO_FONT, textWidth);
  const secondaryTop =
    blockSize(primaryLayout, scale).h - DISPLAY_FONT.descent * scale + SECONDARY_GAP;
  let ink = inkBox(primaryLayout, 'left', scale, 0, 0);
  if (secondaryLayout) ink = union(ink, inkBox(secondaryLayout, 'left', 1, 0, secondaryTop));
  const barWidth = options.accent === false ? 0 : ACCENT_BAR;
  const plateW = ink.w + barWidth + 2 * PLATE_PAD_X;
  const plateH = ink.h + 2 * PLATE_PAD_Y;
  const { safeArea } = env;
  const plateX = options.side === 'left' ? safeArea.x : safeArea.x + safeArea.w - plateW;
  const plateY = safeArea.y + safeArea.h - plateH;
  const contentLeft = plateX + PLATE_PAD_X + (options.side === 'left' ? barWidth : 0);
  const barX = options.side === 'left' ? plateX : plateX + plateW - barWidth;
  return {
    primary: primaryLayout,
    secondary: secondaryLayout,
    scale,
    shiftX: contentLeft - ink.x,
    shiftY: plateY + PLATE_PAD_Y - ink.y,
    secondaryTop,
    plate: { x: plateX, y: plateY, w: plateW, h: plateH },
    bar: { x: barX, y: plateY, w: barWidth, h: plateH },
  };
}

export function renderLowerThird(
  env: CardEnv,
  primary: string,
  secondary: string,
  options: ParsedLowerThirdOptions,
): CardResult {
  const geometry = lowerThirdGeometry(env, primary, secondary, options);
  const primaryColor = env.color(options.color, 'color');
  const secondaryColor = env.color(options.secondaryColor, 'secondaryColor');
  const plateColor = options.plate === false ? undefined : env.color(options.plate, 'plate');
  const accentColor = options.accent === false ? undefined : env.color(options.accent, 'accent');
  const box = geometry.plate;
  const until = options.until ?? Infinity;
  const timing = {
    at: options.at,
    until,
    enter: options.enter,
    exit: options.exit,
    enterDuration: options.enterDuration ?? 0.4,
    exitDuration: options.exitDuration,
  };
  const transform = cardTransform(env.t, timing, { ...env, scale: geometry.scale });
  const result = { box, at: options.at, until, visible: transform.visible };
  if (!transform.visible) return result;
  const paint = paintFor(transform, box, env.height);
  const { dx, dy } = transform;
  const moved = (rect: PixelRect): PixelRect => ({ ...rect, x: rect.x + dx, y: rect.y + dy });
  if (plateColor) env.surface.fillRect(moved(geometry.plate), plateColor, paint);
  if (accentColor) env.surface.fillRect(moved(geometry.bar), accentColor, paint);
  const left = geometry.shiftX + dx;
  const top = geometry.shiftY + dy;
  const primaryLooks = uniformLooks(
    geometry.primary,
    { dx: 0, dy: 0, scale: geometry.scale, color: primaryColor },
    Infinity,
  );
  drawBlock(
    env.surface,
    { layout: geometry.primary, align: 'left', scale: geometry.scale, left, top },
    primaryLooks,
    paint,
  );
  if (geometry.secondary) {
    const looks = uniformLooks(
      geometry.secondary,
      { dx: 0, dy: 0, scale: 1, color: secondaryColor },
      Infinity,
    );
    const block = {
      layout: geometry.secondary,
      align: 'left' as const,
      scale: 1,
      left,
      top: top + geometry.secondaryTop,
    };
    drawBlock(env.surface, block, looks, paint);
  }
  return result;
}

interface KineticText {
  readonly text: string;
  /** Start time of every space-separated token, in reading order. */
  readonly starts: readonly number[];
}

/** Joins the words into one text and gives each token the start time of its word. */
export function kineticText(
  font: BitmapFont,
  words: string | readonly KineticWord[],
  options: Pick<ParsedKineticOptions, 'at' | 'perWordDelay'>,
): KineticText {
  const list = typeof words === 'string' ? words.split(' ') : words;
  const texts: string[] = [];
  const starts: number[] = [];
  let index = 0;
  for (const word of list) {
    const text = font.normalize(typeof word === 'string' ? word : word.text);
    const tokens = text.split(/[ \n]+/).filter((token) => token !== '');
    if (tokens.length === 0) continue;
    const explicit = typeof word === 'string' ? undefined : word.t;
    const start = explicit ?? options.at + index * options.perWordDelay;
    for (let token = 0; token < tokens.length; token += 1) starts.push(start);
    texts.push(text);
    index += 1;
  }
  return { text: texts.join(' '), starts };
}

function kineticLook(
  env: CardEnv,
  options: ParsedKineticOptions,
  scale: number,
  wordIndex: number,
  glyphs: number,
  age: number,
  color: Rgb8,
): WordLook | undefined {
  if (age < 0) return undefined;
  const look = { dx: 0, dy: 0, scale, glyphs, color };
  switch (options.style) {
    case 'pop': {
      const popScale =
        age < POP_STEP ? Math.max(1, scale - 1) : age < 2 * POP_STEP ? scale + 1 : scale;
      return { ...look, scale: popScale };
    }
    case 'typewriter': {
      const delay = Math.min(TYPE_CHAR_DELAY, options.perWordDelay / Math.max(1, glyphs));
      return { ...look, glyphs: Math.min(glyphs, Math.floor(age / delay) + 1) };
    }
    case 'shake': {
      if (age >= WORD_SHAKE) return look;
      const amplitude = WORD_SHAKE_PIXELS * (1 - age / WORD_SHAKE);
      const step = Math.floor(env.t * SHAKE_RATE);
      const dx = jitter(env.seed, step, 2 * wordIndex, amplitude);
      return { ...look, dx, dy: jitter(env.seed, step, 2 * wordIndex + 1, amplitude) };
    }
  }
}

export function renderKinetic(
  env: CardEnv,
  words: string | readonly KineticWord[],
  options: ParsedKineticOptions,
): CardResult {
  const font = fontByName(options.font);
  const scale = options.scale ?? defaultTitleScale(shortEdge(env));
  const { text, starts } = kineticText(font, words, options);
  const maxPixels = options.maxWidth === undefined ? env.safeArea.w : options.maxWidth * env.width;
  const layout = layoutText(text, font, maxUnits(maxPixels, scale));
  const color = env.color(options.color, 'color');
  const highlight =
    options.highlight === false ? undefined : env.color(options.highlight, 'highlight');
  const shadowColor = options.shadow === false ? undefined : env.color(options.shadow, 'shadow');
  const shadow: Shadow | undefined = shadowColor && {
    color: shadowColor,
    offset: shadowOffset(scale),
  };
  const rest = placeBlock(layout, scale, options, env);
  const box = withShadow(inkBox(layout, options.align, scale, rest.left, rest.top), shadow);
  const at = starts.length > 0 ? Math.min(...starts) : options.at;
  const until = options.until ?? Infinity;
  const timing = {
    at,
    until,
    enter: 'none' as const,
    exit: options.exit,
    enterDuration: 1,
    exitDuration: options.exitDuration,
  };
  const transform = cardTransform(env.t, timing, { ...env, scale });
  const wordBoxes = tokenInkBoxes(layout, options.align, scale, rest.left, rest.top);
  const result = { box, at, until, visible: transform.visible, words: wordBoxes };
  if (!transform.visible) return result;
  const latest = Math.max(...starts.filter((start) => start <= env.t));
  const looks = layout.words.map((word, index) => {
    const start = starts[word.token] ?? at;
    const wordColor = highlight && start === latest ? highlight : color;
    const look = kineticLook(
      env,
      options,
      scale,
      index,
      word.glyphs.length,
      env.t - start,
      wordColor,
    );
    return look && { ...look, dx: look.dx + transform.dx, dy: look.dy + transform.dy };
  });
  const block = { layout, align: options.align, scale, ...rest };
  drawBlock(env.surface, block, looks, paintFor(transform, box, env.height), shadow);
  return result;
}
