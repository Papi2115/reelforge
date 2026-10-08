/**
 * Comic page flow and continuity guards (Papi after real run Comic 2: "it does not always FEEL
 * like a comic, the transitions are dry"; the mockup carried things across more than 2-3 panels
 * and unfolded its pages in different directions). Read from the scene sources and the
 * storyboard entries, warnings only:
 * - per scene: a `page.flow` or `page.thread` without an intent, or with a generic one;
 * - per film (final review): a dry run (DRY_RUN or more shots in a row entering on a plain cut,
 *   no page-native transition, no continuity link, no page that carries the eye with a flow or a
 *   thread; the storyboard caps non-cut transitions, so in-page flow is the usual cure), the same page flow on SAME_FLOW_RUN pages in a
 *   row (the same preset, the same number of side-by-side beats, the same flow direction), and a
 *   film of LONG_FILM_SHOTS or more that never carries one thing across three panels or shots (no
 *   `page.thread`, no two continuity links in a row).
 */
import type { AnyNode } from 'acorn';
import type { QaFinding, StoryboardShot } from '@reelforge/shared';
import { finding } from '../scenes/checks.js';
import { visit } from '../scenes/source-checks.js';
import { genericIntent } from './popup-intent.js';
import { calleeName, literalString, propertyKey } from './source-text.js';
import type { ShotEntry, ShotProgram } from './world-labels.js';

/** Plain cuts in a row from which a run is dry. */
export const DRY_RUN = 4;
/** Pages in a row with the same flow from which the flow is monotone. */
export const SAME_FLOW_RUN = 3;
/** Films with at least this many shots must carry one thing across three panels or shots. */
export const LONG_FILM_SHOTS = 6;

const slop = (message: string): QaFinding => finding('slop', 'warning', message);

function property(node: AnyNode | undefined, key: string): AnyNode | undefined {
  if (node?.type !== 'ObjectExpression') return undefined;
  for (const entry of node.properties) {
    if (entry.type === 'Property' && propertyKey(entry) === key) return entry.value;
  }
  return undefined;
}

/** How a storyboard shot enters: a plain cut, a continuity link or a page-native transition. */
export function shotEntry(shot: StoryboardShot): ShotEntry {
  const transition = shot.transitionIn;
  if (transition === undefined || transition.type === 'cut') {
    return shot.continuity === undefined ? 'cut' : 'link';
  }
  const linked = shot.continuity !== undefined || transition.style?.startsWith('continuity-');
  return linked === true ? 'link' : 'page';
}

/** Missing or generic intents of a scene's `page.flow` / `page.thread` calls. */
export function comicFlowSourceFindings(program: AnyNode, file: string): QaFinding[] {
  const found: QaFinding[] = [];
  visit(program, (node) => {
    const kind = calleeName(node);
    if (node.type !== 'CallExpression' || (kind !== 'flow' && kind !== 'thread')) return;
    const [options] = node.arguments;
    if (options?.type !== 'ObjectExpression') return;
    const at = `${file}:${String(node.loc?.start.line ?? 1)}`;
    const intent = property(options, 'intent');
    const text = intent === undefined ? undefined : literalString(intent);
    if (intent === undefined) {
      found.push(
        slop(`${kind} without an intent (${at}): say what the ${kind} means in the narration.`),
      );
    } else if (text !== undefined && genericIntent(text)) {
      found.push(
        slop(`generic ${kind} intent "${text}" (${at}): say what it means in the narration.`),
      );
    }
  });
  return found;
}

/** The page flow of a scene: `flow down`, `panels 2-up`, `layout 2 beats`; undefined = free. */
export function pageFlowOf(program: AnyNode): string | undefined {
  let flow: string | undefined;
  visit(program, (node) => {
    if (flow !== undefined || node.type !== 'CallExpression') return;
    const kind = calleeName(node);
    const [first, second] = node.arguments;
    if (kind === 'flow') {
      const direction = literalString(property(first, 'direction'));
      if (direction !== undefined) flow = `flow ${direction}`;
    } else if (kind === 'panels' && first !== undefined && first.type !== 'SpreadElement') {
      const preset = literalString(first);
      if (preset !== undefined) flow = `panels ${preset}`;
    } else if (kind === 'layout' && first?.type === 'ArrayExpression') {
      const preset = literalString(property(second, 'layout'));
      flow =
        preset === undefined ? `layout ${String(first.elements.length)} beats` : `panels ${preset}`;
    }
  });
  return flow;
}

function calls(program: AnyNode, names: readonly string[]): boolean {
  let found = false;
  visit(program, (node) => {
    const name = node.type === 'CallExpression' ? calleeName(node) : undefined;
    if (name !== undefined && names.includes(name)) found = true;
  });
  return found;
}

const hasThread = (program: AnyNode) => calls(program, ['thread']);
/** A page that carries the eye on its own (a read strip, a thread over its panels). */
const flowing = (program: AnyNode) => calls(program, ['thread', 'flow']);

function add(found: Map<string, QaFinding[]>, shotId: string, entry: QaFinding): void {
  found.set(shotId, [...(found.get(shotId) ?? []), entry]);
}

/** Dry runs, monotone page flow and a film without long continuity (final review). */
export function comicFlowFilmFindings(shots: readonly ShotProgram[]): Map<string, QaFinding[]> {
  const found = new Map<string, QaFinding[]>();
  let cuts = 0;
  shots.forEach((shot, i) => {
    cuts = i > 0 && shot.entry === 'cut' && !flowing(shot.program) ? cuts + 1 : 0;
    if (cuts >= DRY_RUN) {
      add(
        found,
        shot.shotId,
        slop(
          `dry run: ${String(cuts)} shots in a row enter on a plain cut and none carries the eye: let this page flow (page.flow down or across, a page.thread over its panels), or give it a page-native transition or a continuity link from the last page.`,
        ),
      );
    }
  });
  const flows = shots.map((shot) => pageFlowOf(shot.program));
  flows.forEach((flow, i) => {
    const run = flows.slice(Math.max(0, i - SAME_FLOW_RUN + 1), i + 1);
    if (
      flow !== undefined &&
      run.length === SAME_FLOW_RUN &&
      run.every((other) => other === flow)
    ) {
      add(
        found,
        shots[i]?.shotId ?? '',
        slop(
          `same page flow on ${String(SAME_FLOW_RUN)} pages in a row (${flow}): let this page unfold another way (page.flow down a tall column, across a long band, a diagonal stair, another preset).`,
        ),
      );
    }
  });
  const chained = shots.some(
    (shot, i) => i > 0 && shot.entry === 'link' && shots[i + 1]?.entry === 'link',
  );
  const first = shots[0];
  if (
    first !== undefined &&
    shots.length >= LONG_FILM_SHOTS &&
    !chained &&
    !shots.some((shot) => hasThread(shot.program))
  ) {
    add(
      found,
      first.shotId,
      slop(
        `no long continuity: nothing is carried across three panels or shots in ${String(shots.length)} shots; carry one thing of the narration over 3+ panels with page.thread, or link two shots in a row to the same object.`,
      ),
    );
  }
  return found;
}
