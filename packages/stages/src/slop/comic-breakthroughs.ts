/**
 * Comic breakthroughs are never a template (PLAN.md#13.15, real run Comic 2: the flashback was
 * the kit example's own `cover: 'strip'` + `arrange: 'row'`, the spread the same `pull-back` as
 * the film before). Read from the scene source (no execution), warnings only:
 * - the mechanism of a `page.panelBreak` (the open toolkit): its entrances, what its moves change
 *   (and whether one panel drags others after it), its gutters and a `drive`; the shared
 *   breakthrough guard then flags the same mechanism twice in a film and a missing intent;
 * - a breakthrough whose option set IS a showcase template: a flashback or spread with exactly the
 *   options of the showcase / kit inspiration examples (f1, f2, s1, s2), or a panel break with
 *   exactly the mechanism of one of the kit's panel-break examples (b1-b3).
 */
import type { AnyNode } from 'acorn';
import type { QaFinding } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { optionsOf } from './breakthrough-intent.js';
import { calleeName, literalString, propertyKey } from './source-text.js';

/** A template: the options (or mechanism) that make it, and where it comes from. */
interface Template {
  readonly options: Readonly<Record<string, string>>;
  readonly source: string;
}

/** Option sets of the showcase and the kit's inspiration examples (packages/kit/examples/comic). */
export const COMIC_SHOWCASE_TEMPLATES: Readonly<Record<string, readonly Template[]>> = {
  flashback: [
    { options: { cover: 'page', arrange: 'rows' }, source: "the showcase's flashback (f1)" },
    { options: { cover: 'strip', arrange: 'row' }, source: 'the kit example f2' },
  ],
  spread: [
    { options: { assemble: 'merge', pieces: 'grid' }, source: "the showcase's spread (s1)" },
    { options: { assemble: 'unfold' }, source: 'the kit example s2' },
  ],
};

/**
 * Mechanisms of the kit's panel-break examples (examples/comic/open/b1-b3); a test reads them
 * back from the example files, so they cannot drift.
 */
export const COMIC_BREAK_EXAMPLES: Readonly<Record<string, string>> = {
  'b1 (glacier)': 'enter cut,unroll + moves box,rotate + gutters lift',
  'b2 (bridge)': 'enter grow + moves box + gutters close',
  'b3 (levee)': 'enter cut + moves rotate,x,y chain + gutters tear + drive',
};

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

function property(node: AnyNode | undefined, key: string): AnyNode | undefined {
  if (node?.type !== 'ObjectExpression') return undefined;
  for (const entry of node.properties) {
    if (entry.type === 'Property' && propertyKey(entry) === key) return entry.value;
  }
  return undefined;
}

/** The object literals of an array literal; undefined when it is not one (built at run time). */
function objects(node: AnyNode | undefined): AnyNode[] | undefined {
  if (node === undefined) return [];
  if (node.type !== 'ArrayExpression') return undefined;
  const out: AnyNode[] = [];
  for (const element of node.elements) {
    if (element?.type !== 'ObjectExpression') return undefined;
    out.push(element);
  }
  return out;
}

/** A literal option, its default when absent, undefined when computed. */
function literalOr(node: AnyNode | undefined, key: string, fallback: string): string | undefined {
  const value = property(node, key);
  return value === undefined ? fallback : literalString(value);
}

/**
 * `enter cut,swing + moves box,x chain + gutters close + drive` of a `page.panelBreak` options
 * node; undefined when a part is built at run time.
 */
export function panelBreakMechanism(options: AnyNode | undefined): string | undefined {
  const panels = objects(property(options, 'panels'));
  const moves = objects(property(options, 'moves'));
  if (panels === undefined || moves === undefined) return undefined;
  const enters = new Set<string>();
  for (const panel of panels) {
    const enter = literalOr(panel, 'enter', 'cut');
    if (enter === undefined) return undefined;
    enters.add(enter);
  }
  const props = new Set<string>();
  let chain = false;
  for (const move of moves) {
    const to = property(move, 'to');
    if (to?.type !== 'ObjectExpression') return undefined;
    for (const entry of to.properties) {
      const key = propertyKey(entry);
      if (key !== undefined) props.add(key);
    }
    const target = property(move, 'target');
    if (target?.type === 'ArrayExpression' && target.elements.length > 1) chain = true;
  }
  const gutters = literalOr(property(options, 'gutters'), 'kind', 'keep');
  if (gutters === undefined) return undefined;
  const parts = [
    `enter ${[...enters].sort().join(',')}`,
    `moves ${props.size === 0 ? 'none' : [...props].sort().join(',')}${chain ? ' chain' : ''}`,
    `gutters ${gutters}`,
  ];
  if (property(options, 'drive') !== undefined) parts.push('drive');
  return parts.join(' + ');
}

function matches(options: AnyNode | undefined, template: Template): boolean {
  return Object.entries(template.options).every(
    ([key, value]) => literalString(property(options, key)) === value,
  );
}

/** Breakthroughs of a scene that replay a showcase template or a kit example's mechanism (⚠). */
export function comicShowcaseFindings(program: AnyNode, file: string): QaFinding[] {
  const found: QaFinding[] = [];
  visit(program, (node) => {
    const kind = calleeName(node);
    if (node.type !== 'CallExpression' || kind === undefined) return;
    const at = `${file}:${String(node.loc?.start.line ?? 1)}`;
    const options = optionsOf(node);
    const template = COMIC_SHOWCASE_TEMPLATES[kind]?.find((entry) => matches(options, entry));
    if (template !== undefined) {
      const set = Object.entries(template.options)
        .map(([key, value]) => `${key} ${value}`)
        .join(' + ');
      found.push(
        slop(
          `${kind} replays a showcase template (${set} = ${template.source}) (${at}): invent the mechanism for this claim with page.panelBreak, or another combination.`,
        ),
      );
    }
    if (kind !== 'panelBreak') return;
    const mechanism = panelBreakMechanism(options);
    const example = Object.entries(COMIC_BREAK_EXAMPLES).find(([, known]) => known === mechanism);
    if (example !== undefined) {
      found.push(
        slop(
          `panelBreak replays the kit example ${example[0]} (${example[1]}) (${at}): invent a mechanism whose motion shows THIS claim.`,
        ),
      );
    }
  });
  return found;
}
