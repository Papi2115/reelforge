/**
 * Game B2 craft guards from real run Game B2 2 (docs/real-run-game-b2-2.md, defects 2, 5, 6, 11);
 * warnings only, like every slop guard.
 * Per scene (`b2CraftFindings`): numbers popping off nothing (`hud.damage` in a shot with no meter
 * and no boss bar: "2" and "5" floating off a heap) and a web address on screen (a source name as
 * HUD text: sources belong in the publish kit).
 * Over the film (`b2FilmFindings`, final review): the same full-frame menu layout twice (a quest
 * log + inventory in s02 and again in s04); the film ending on a black screen (its last shot an
 * automap cut over black or a tally on `backdrop: 'dark'`); a `shared-object` link whose item is
 * not in the hand at the seam (the next shot opens holding an icon the shot before never put in
 * the hand, or lowered with `until`).
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { calleeName, literalString, propertyKey } from './source-text.js';
import type { ShotProgram } from './world-labels.js';

/** A web address or a site name (`SCIENCEALERT.COM`, `www.`, `https://`). */
const WEB_ADDRESS =
  /https?:\/\/|\bwww\.[a-z0-9-]{2,}\.[a-z]{2,}|\b[a-z][a-z0-9-]{2,}\.(?:com|org|net|gov|edu|io|info|co\.uk)\b/i;
const MENU_PARTS = ['quest', 'stats', 'inventory'] as const;
const HAND_CALLS = new Set(['take', 'hold']);

function calls(program: AnyNode, name: string): (AnyNode & { type: 'CallExpression' })[] {
  const found: (AnyNode & { type: 'CallExpression' })[] = [];
  visit(program, (node) => {
    if (node.type === 'CallExpression' && calleeName(node) === name) found.push(node);
  });
  return found;
}

/** The object literal argument `index` of a call, as its property nodes by key. */
function options(call: AnyNode & { type: 'CallExpression' }, index: number): Map<string, AnyNode> {
  const argument = call.arguments[index];
  const out = new Map<string, AnyNode>();
  if (argument?.type !== 'ObjectExpression') return out;
  for (const property of argument.properties) {
    const key = propertyKey(property);
    if (key !== undefined && property.type === 'Property') out.set(key, property.value);
  }
  return out;
}

/** Strings never on screen: the scene's `meta` and every `intent`. */
function offScreen(program: AnyNode): Set<AnyNode> {
  const skipped = new Set<AnyNode>();
  visit(program, (node) => {
    const target =
      node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === 'meta'
        ? node.init
        : node.type === 'Property' && propertyKey(node) === 'intent'
          ? node.value
          : undefined;
    if (target) visit(target, (inner) => skipped.add(inner));
  });
  return skipped;
}

/** Per-scene craft findings (see the module comment). */
export function b2CraftFindings(program: AnyNode, file: string): QaFinding[] {
  const out: QaFinding[] = [];
  const damages = calls(program, 'damage');
  if (damages.length > 0 && calls(program, 'meter').length + calls(program, 'boss').length === 0)
    out.push(
      finding(
        'slop',
        'warning',
        `numbers popping off nothing (${file}:${String(damages[0]?.loc?.start.line ?? 1)}): hud.damage is a meter's or the boss bar's loss; with neither in the shot the number is decoration. Show the number where it means something (a tally row, the narration box, a meter of the thing really in danger) or leave it out.`,
      ),
    );
  const skipped = offScreen(program);
  let web: string | undefined;
  visit(program, (node) => {
    const text = skipped.has(node) ? undefined : literalString(node);
    if (web === undefined && text !== undefined && WEB_ADDRESS.test(text)) web = text;
  });
  if (web !== undefined)
    out.push(
      finding(
        'slop',
        'warning',
        `a web address on screen ("${web}"): sources go in the publish kit, never in the HUD; write what the source says in the narration's words instead.`,
      ),
    );
  return out;
}

/** "quest + inventory": the parts of a `hud.menu` layout. */
function menuLayouts(program: AnyNode): string[] {
  return calls(program, 'menu').flatMap((call) => {
    const keys = options(call, 0);
    const parts = MENU_PARTS.filter((part) => keys.has(part));
    return parts.length === 0 ? [] : [parts.join(' + ')];
  });
}

/** The last shot ends on black: an automap cut over black or a tally on the dark. */
function endsOnBlack(program: AnyNode): string | undefined {
  for (const call of calls(program, 'automap')) {
    const keys = options(call, 0);
    const exit = literalString(keys.get('exit'));
    const backdrop = literalString(keys.get('backdrop'));
    if (exit === 'cut' && backdrop !== 'freeze') return "an automap cut over black with exit 'cut'";
  }
  for (const call of calls(program, 'tally'))
    if (literalString(options(call, 0).get('backdrop')) === 'dark') return "a tally on 'dark'";
  return undefined;
}

/** Icons the hand holds or takes, with whether a call of it lowers the hand (`until`). */
function handIcons(program: AnyNode): Map<string, { lowered: boolean; opens: boolean }> {
  const icons = new Map<string, { lowered: boolean; opens: boolean }>();
  visit(program, (node) => {
    const name = node.type === 'CallExpression' ? calleeName(node) : undefined;
    if (node.type !== 'CallExpression' || name === undefined || !HAND_CALLS.has(name)) return;
    const icon = literalString(options(node, 0).get('icon'));
    if (icon === undefined) return;
    const timing = options(node, 1);
    const at = timing.get('at');
    const start = at?.type === 'Literal' && typeof at.value === 'number' ? at.value : undefined;
    const negative =
      at?.type === 'UnaryExpression' && at.operator === '-' && at.argument.type === 'Literal';
    const before = icons.get(icon) ?? { lowered: false, opens: false };
    icons.set(icon, {
      lowered: before.lowered || timing.has('until'),
      opens: before.opens || (name === 'hold' && (negative || (start !== undefined && start <= 0))),
    });
  });
  return icons;
}

function linkFindings(previous: ShotProgram, shot: ShotProgram): QaFinding[] {
  const before = handIcons(previous.program);
  return [...handIcons(shot.program)].flatMap(([icon, use]): QaFinding[] => {
    if (!use.opens) return [];
    const earlier = before.get(icon);
    if (earlier !== undefined && !earlier.lowered) return [];
    const why =
      earlier === undefined
        ? `${previous.shotId} never puts it in the hand`
        : `${previous.shotId} lowers it before the cut (until)`;
    return [
      finding(
        'slop',
        'warning',
        `the linked item blinks at the seam: ${shot.shotId} opens holding '${icon}' but ${why}. End ${previous.shotId} with it held still (take it >= 2 s before the end or hold it with no until).`,
      ),
    ];
  });
}

/** Film-level craft findings by shot id (see the module comment). */
export function b2FilmFindings(shots: readonly ShotProgram[]): Map<string, QaFinding[]> {
  const found = new Map<string, QaFinding[]>();
  const add = (shotId: string, entry: QaFinding): void => {
    found.set(shotId, [...(found.get(shotId) ?? []), entry]);
  };
  const seen = new Map<string, string>();
  shots.forEach((shot, index) => {
    for (const layout of new Set(menuLayouts(shot.program))) {
      const first = seen.get(layout);
      if (first === undefined) seen.set(layout, shot.shotId);
      else
        add(
          shot.shotId,
          finding(
            'slop',
            'warning',
            `the same full-frame menu (${layout}) as ${first}: one paused menu per film; take stock here with another screen (the tally, the automap, a stat sheet over the level) or keep the walk and carry the facts in the HUD (a toast, the inventory bar).`,
          ),
        );
    }
    const previous = shots[index - 1];
    if (previous !== undefined && shot.entry === 'link')
      for (const entry of linkFindings(previous, shot)) add(shot.shotId, entry);
  });
  const last = shots.at(-1);
  const black = last === undefined ? undefined : endsOnBlack(last.program);
  if (last !== undefined && black !== undefined)
    add(
      last.shotId,
      finding(
        'slop',
        'warning',
        `the film ends on a black screen (${black}): end it over the level (automap backdrop: 'freeze' or exit: 'fold', a tally on 'freeze' or 'live').`,
      ),
    );
  return found;
}
