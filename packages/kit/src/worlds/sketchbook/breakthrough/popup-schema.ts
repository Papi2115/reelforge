/**
 * Spec of `page.popup(...)` (a pop-up card, docs/worlds/sketchbook-v2 shot 5): the card, at most
 * six paper elements standing up from its fold, the opening, an optional red-pen pull and a
 * parallax nudge. Positions are in card px: `u` from the card's left edge, `depth` from the fold
 * toward the viewer. `checkPopup` adds the rules zod cannot say (fits, one pulled arm, lettering).
 */
import { z } from 'zod';
import { KitError } from '../../../errors.js';
import { whenParam } from '../../../looks/blueprint/timing.js';
import { LETTERING_CHARS } from '../draw/glyphs.js';
import { textWidth } from '../draw/lettering.js';
import { SWATCH_NAMES, type SwatchName } from '../inks.js';

export const POPUP_LIMITS = { elements: 6, arms: 2 } as const;
/** Height of the arm pivot above the fold (card px). */
export const ARM_PIVOT = 8;

const swatch = z.enum(SWATCH_NAMES as unknown as readonly [SwatchName, ...SwatchName[]]);
const text = (max: number) => z.string().min(1).max(max);

const block = z.object({
  kind: z.literal('block'),
  u: z.number().min(0).describe('Left edge (card px from the card left)'),
  w: z.number().min(40).max(220).default(102),
  h: z.number().min(30).max(140).default(72).describe('Height when standing'),
  depth: z.number().min(10).max(140).default(30).describe('Foot distance from the fold'),
  band: text(12).optional().describe('Small printed word on a dark band (MARCH)'),
  text: text(6).describe('Big printed word or number on the front (21)'),
});

const arm = z.object({
  kind: z.literal('arm'),
  u: z.number().min(0).describe('Pivot (brad) on the backdrop, card px from the left'),
  length: z.number().min(60).max(220).default(160),
  piece: z.enum(['sun', 'disc']).default('sun').describe('Cut-paper sun, or a coloured disc'),
  color: swatch.default('skyPencil').describe('Colour of a disc'),
  label: text(4).optional().describe('Printed on a disc'),
  angle: z.number().min(-70).max(70).default(22.7).describe('Degrees from upright, + = right'),
  swing: z.number().min(-70).max(70).optional().describe('Angle after the pull (needs pull)'),
});

const cutout = z.object({
  kind: z.literal('cutout'),
  u: z.number().min(0),
  w: z.number().min(40).max(220).default(80),
  h: z.number().min(50).max(160).default(110),
  depth: z.number().min(10).max(140).default(60),
  draw: z.enum(['figure', 'sun', 'none']).default('figure').describe('Felt drawing on the card'),
  pose: z.enum(['stand', 'cheer', 'point']).default('stand'),
  text: text(12).optional().describe('Hand-lettered word under the drawing'),
});

const tag = z.object({
  kind: z.literal('tag'),
  lines: z.array(text(10)).min(1).max(2).describe('One or two short words'),
  u: z.number().optional().describe('Card px (default: below the first block, right)'),
  depth: z.number().optional(),
});

const note = z.object({
  kind: z.literal('note'),
  text: text(28).describe("The maker's pencil note on the card floor"),
  u: z.number().default(34),
  depth: z.number().default(114),
});

export const popupElement = z.discriminatedUnion('kind', [block, arm, cutout, tag, note]);
export type PopupElement = z.output<typeof popupElement>;

export const popupOptions = z.object({
  x: z.number().min(40).max(700).default(380).describe('Left edge of the card (page px)'),
  y: z.number().min(60).max(400).default(272).describe('The fold line (page px)'),
  w: z.number().min(200).max(600).default(412).describe('Card width'),
  depth: z.number().min(120).max(240).default(196).describe('Depth of the base and of the cover'),
  at: whenParam.optional().describe('The pencil hand starts lifting the cover (default 0.36)'),
  elements: z
    .array(popupElement)
    .min(1)
    .max(POPUP_LIMITS.elements)
    .describe('block / arm / cutout / tag / note, at most 6'),
  pull: z
    .object({ at: whenParam.describe('The red pen presses the tab') })
    .optional()
    .describe('The red pen pulls the tab: the arm with `swing` moves; red loop + arrow follow'),
  camera: z
    .object({
      dx: z.number().min(-90).max(90).default(0),
      dy: z.number().min(-90).max(90).default(0),
    })
    .default({ dx: 0, dy: 0 })
    .describe('Eye drift (page px) while the card opens: parallax of the standing pieces'),
  seed: z.int().min(0).optional(),
});
export type PopupOptions = z.output<typeof popupOptions>;

function fail(call: string, message: string): never {
  throw new KitError('invalid-params', `${call}: ${message}`);
}

/** Every character must be one the hand can letter. */
export function checkLettering(value: string, where: string, call: string): void {
  for (const char of value) {
    if (!LETTERING_CHARS.includes(char) && !LETTERING_CHARS.includes(char.toUpperCase())) {
      fail(call, `${where}: the hand cannot letter "${char}" in "${value}"`);
    }
  }
}

function checkElement(o: PopupOptions, e: PopupElement, index: number, call: string): void {
  const where = `elements.${String(index)} (${e.kind})`;
  if (e.kind === 'block' || e.kind === 'cutout') {
    if (e.u + e.w > o.w)
      fail(call, `${where}: u + w = ${String(e.u + e.w)} is past the card width ${String(o.w)}`);
    if (e.depth + e.h > o.depth - 4) {
      fail(call, `${where}: depth + h must fit under the cover (<= ${String(o.depth - 4)})`);
    }
  }
  if (e.kind === 'block') {
    checkLettering(e.text, where, call);
    if (textWidth(e.text, Math.min(36, e.h * 0.5), 'type') > e.w - 8) {
      fail(call, `${where}: "${e.text}" is too wide for the block; shorten it or widen w`);
    }
    if (e.band !== undefined) {
      checkLettering(e.band, where, call);
      if (textWidth(e.band, 11, 'type') > e.w - 8)
        fail(call, `${where}: band "${e.band}" is too wide`);
    }
  }
  if (e.kind === 'arm') {
    if (e.u > o.w) fail(call, `${where}: u is past the card width`);
    if (ARM_PIVOT + e.length + 24 > o.depth + 4) {
      fail(
        call,
        `${where}: length must be <= ${String(o.depth - ARM_PIVOT - 20)} (the piece stays on the backdrop)`,
      );
    }
    if (e.swing !== undefined && o.pull === undefined) fail(call, `${where}: swing needs pull`);
    if (e.label !== undefined) checkLettering(e.label, where, call);
  }
  if (e.kind === 'cutout' && e.text !== undefined) checkLettering(e.text, where, call);
  if (e.kind === 'tag')
    e.lines.forEach((line) => {
      checkLettering(line, where, call);
    });
  if (e.kind === 'note') {
    checkLettering(e.text, where, call);
    if (e.depth < 0 || e.depth > o.depth - 10)
      fail(call, `${where}: depth must be on the card floor`);
  }
}

/** The rules beyond the schema; returns the index of the pulled arm (or -1). */
export function checkPopup(o: PopupOptions, call: string): number {
  o.elements.forEach((element, index) => {
    checkElement(o, element, index, call);
  });
  const arms = o.elements.filter((element) => element.kind === 'arm');
  if (arms.length > POPUP_LIMITS.arms) fail(call, `at most ${String(POPUP_LIMITS.arms)} arms`);
  const swung = o.elements.flatMap((element, index) =>
    element.kind === 'arm' && element.swing !== undefined ? [index] : [],
  );
  if (o.pull !== undefined && swung.length !== 1) {
    fail(call, 'pull moves exactly one arm: give one arm a swing angle');
  }
  return swung[0] ?? -1;
}
