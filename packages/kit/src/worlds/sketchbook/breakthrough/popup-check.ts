/**
 * The rules of a `page.popup` spec beyond its schema: every piece fits the card, every word can
 * be lettered, ids are unique, no piece is empty decoration (a disc says what it is, a card
 * carries a word or a drawing), and a pull moves something real: at least one motion (or a
 * drive), each on a piece of this card, each property one its kind has; `notch` only for an arm.
 */
import { KitError } from '../../../errors.js';
import { LETTERING_CHARS } from '../draw/glyphs.js';
import { textWidth } from '../draw/lettering.js';
import { ARM_PIVOT, MOTION_PROPS, POPUP_LIMITS } from './popup-schema.js';
import type { PopupElement, PopupOptions } from './popup-schema.js';

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

function words(e: PopupElement): string[] {
  switch (e.kind) {
    case 'block':
      return [e.text, ...(e.band === undefined ? [] : [e.band])];
    case 'cutout':
    case 'card':
    case 'flap':
      return e.text === undefined ? [] : [e.text];
    case 'arm':
      return e.label === undefined ? [] : [e.label];
    case 'gauge':
      return [...(e.label === undefined ? [] : [e.label]), ...e.marks];
    case 'wheel':
      return e.labels;
    case 'counter':
      return [e.prefix, e.suffix].filter((part) => part.length > 0);
    case 'window':
      return e.items;
    case 'scale':
      return [...e.ends];
    case 'tag':
      return e.lines;
    case 'note':
      return [e.text];
  }
}

function checkFit(o: PopupOptions, e: PopupElement, where: string, call: string): void {
  if (e.kind === 'block' || e.kind === 'cutout') {
    if (e.u + e.w > o.w)
      fail(call, `${where}: u + w = ${String(e.u + e.w)} is past the card width ${String(o.w)}`);
    if (e.depth + e.h > o.depth - 4) {
      fail(call, `${where}: depth + h must fit under the cover (<= ${String(o.depth - 4)})`);
    }
  }
  if (e.kind === 'block' && textWidth(e.text, Math.min(36, e.h * 0.5), 'type') > e.w - 8) {
    fail(call, `${where}: "${e.text}" is too wide for the block; shorten it or widen w`);
  }
  if (e.kind === 'block' && e.band !== undefined && textWidth(e.band, 11, 'type') > e.w - 8) {
    fail(call, `${where}: band "${e.band}" is too wide`);
  }
  if (e.kind === 'arm') {
    if (e.u > o.w) fail(call, `${where}: u is past the card width`);
    if (ARM_PIVOT + e.length + 24 > o.depth + 4) {
      fail(
        call,
        `${where}: length must be <= ${String(o.depth - ARM_PIVOT - 20)} (the piece stays on the backdrop)`,
      );
    }
  }
  if ('v' in e && 'u' in e && (e.u > o.w || e.v > o.depth - 10)) {
    fail(
      call,
      `${where}: u/v must be on the backdrop (u <= ${String(o.w)}, v <= ${String(o.depth - 10)})`,
    );
  }
  if (e.kind === 'note' && (e.depth < 0 || e.depth > o.depth - 10)) {
    fail(call, `${where}: depth must be on the card floor`);
  }
}

/** No empty decoration: every piece says or shows something. */
function checkMeaning(e: PopupElement, where: string, call: string): void {
  if (e.kind === 'arm' && e.piece === 'disc' && e.label === undefined) {
    fail(call, `${where}: a disc must say what it stands for (label), or use a sun / a card`);
  }
  if (e.kind === 'card' && e.text === undefined && e.draw === 'none') {
    fail(call, `${where}: a card needs text or a drawing (no blank decoration)`);
  }
  if (e.kind === 'cutout' && e.text === undefined && e.draw === 'none') {
    fail(call, `${where}: a cut-out needs a drawing or a word`);
  }
}

function checkPull(o: PopupOptions, call: string): void {
  const pull = o.pull;
  if (!pull) return;
  if (pull.motions.length === 0 && !pull.drive) {
    fail(call, 'pull moves nothing: bind at least one motion (or a drive) to a piece');
  }
  const byId = new Map<string, PopupElement>();
  for (const element of o.elements) {
    if ('id' in element && element.id !== undefined) byId.set(element.id, element);
  }
  pull.motions.forEach((motion, index) => {
    const where = `pull.motions.${String(index)}`;
    const target = byId.get(motion.target);
    if (!target) {
      fail(call, `${where}: "${motion.target}" is not a piece of this card (give a piece that id)`);
    }
    const allowed = MOTION_PROPS[target.kind];
    for (const prop of [...Object.keys(motion.to), ...Object.keys(motion.from ?? {})]) {
      if (!allowed.includes(prop)) {
        fail(
          call,
          `${where}: the ${target.kind} cannot move "${prop}" (it has ${allowed.join(', ') || 'nothing'})`,
        );
      }
    }
    if (Object.keys(motion.to).length === 0) fail(call, `${where}: to is empty`);
    if (motion.span[1] <= motion.span[0]) fail(call, `${where}: span must go forward`);
  });
  if (pull.focus !== undefined && !byId.has(pull.focus)) {
    fail(call, `pull.focus: "${pull.focus}" is not a piece of this card`);
  }
  if (pull.callout === 'notch') {
    const first = byId.get(pull.motions[0]?.target ?? '');
    if (first?.kind !== 'arm' || !('angle' in (pull.motions[0]?.to ?? {}))) {
      fail(call, 'callout notch needs the first motion to swing an arm (to: { angle })');
    }
  }
}

/** The rules beyond the schema. */
export function checkPopup(o: PopupOptions, call: string): void {
  const ids = new Set<string>();
  o.elements.forEach((element, index) => {
    const where = `elements.${String(index)} (${element.kind})`;
    for (const word of words(element)) checkLettering(word, where, call);
    checkFit(o, element, where, call);
    checkMeaning(element, where, call);
    if ('id' in element && element.id !== undefined) {
      if (ids.has(element.id)) fail(call, `${where}: id "${element.id}" is used twice`);
      ids.add(element.id);
    }
  });
  const arms = o.elements.filter((element) => element.kind === 'arm');
  if (arms.length > POPUP_LIMITS.arms) fail(call, `at most ${String(POPUP_LIMITS.arms)} arms`);
  checkPull(o, call);
}
