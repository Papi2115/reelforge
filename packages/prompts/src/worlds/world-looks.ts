/**
 * A world's prompt wording for a project that turned some of its looks off (PLAN.md#14.12,
 * project.json `worldLooks`, Grim Ink): the storyboard's "Rolls and looks" lines keep only the
 * looks in use, lettered by place (the first look kept is the A roll, the next B, then C), plus one
 * line naming the looks that are off; the moment catalog drops the moments only an off look can
 * host (the storyboard validator and its quota then never ask for them). With every look on the
 * text is returned as it is, so the prompts stay byte for byte as before.
 */
import { worldRollLetter } from '@reelforge/shared';
import type { WorldMomentOption, WorldPromptText } from './types.js';

/** A roll line of a world's `rolls` text: "- `A` = the scene (`ink-scene`: …)". */
const ROLL_LINE = /^- `[A-Z]`/u;

function rollLines(rolls: string, all: readonly string[], kept: readonly string[]): string[] {
  return rolls.split('\n').flatMap((line) => {
    const head = ROLL_LINE.exec(line);
    if (head === null) return [line];
    const look = all.find((id) => line.includes(`\`${id}\``));
    if (look === undefined) return [line];
    const index = kept.indexOf(look);
    return index < 0 ? [] : [`- \`${worldRollLetter(index)}\`${line.slice(head[0].length)}`];
  });
}

function offLine(off: readonly string[]): string {
  const names = off.map((id) => `\`${id}\``).join(' and ');
  const them = off.length === 1 ? 'it' : 'them';
  return `- Turned off in this project (Project settings → Looks of this world): ${names}. Never use ${them}; wherever this prompt mentions ${them} or ${off.length === 1 ? 'its roll' : 'their rolls'}, use the looks above instead. The roll letters are the ones in this list.`;
}

/** The moments a look in use can host (each keeps only its looks in use). */
function momentsFor(
  moments: readonly WorldMomentOption[],
  kept: readonly string[],
): WorldMomentOption[] {
  return moments.flatMap((moment) => {
    if (moment.looks.length === 0) return [moment];
    const looks = moment.looks.filter((id) => kept.includes(id));
    if (looks.length === 0) return [];
    return [looks.length === moment.looks.length ? moment : { ...moment, looks }];
  });
}

/**
 * The world's text for the looks in use: `all` = the world's looks (A roll first), `kept` = the
 * project's looks in use, in the same order (`enabledWorldLooks` of @reelforge/shared).
 */
export function worldTextForLooks(
  text: WorldPromptText,
  all: readonly string[],
  kept: readonly string[],
): WorldPromptText {
  const off = all.filter((id) => !kept.includes(id));
  if (off.length === 0 || kept.length === 0) return text;
  return {
    ...text,
    rolls: [...rollLines(text.rolls, all, kept), offLine(off)].join('\n'),
    moments: momentsFor(text.moments, kept),
  };
}
