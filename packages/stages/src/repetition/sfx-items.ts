/**
 * SFX repetitions (analyse.ts): the same recipe 3+ times in 30 s or twice in a row; a designed
 * series of close cues counts once. Re-picks never touch a cue in a locked shot.
 */
import { SFX_RECIPES, type SfxRecipe } from '@reelforge/pipeline';
import type { RepetitionChange, RepetitionItem } from '@reelforge/shared';
import { clusters } from './clusters.js';
import { cueKey, fmt, item, span, type Context, type FilmCue } from './items.js';
import { repickSfx } from './proposals.js';

const isRecipe = (name: string): name is SfxRecipe =>
  (SFX_RECIPES as readonly string[]).includes(name);

interface SoundOccurrence {
  readonly t: number;
  readonly cues: readonly FilmCue[];
}

/** Same-recipe cues closer than the series gap are one designed series (one occurrence). */
function soundOccurrences(cues: readonly FilmCue[], seriesS: number): SoundOccurrence[] {
  const out: { t: number; cues: FilmCue[] }[] = [];
  for (const cue of cues) {
    const last = out.at(-1);
    const lastCue = last?.cues.at(-1);
    if (last !== undefined && lastCue !== undefined && cue.t - lastCue.t < seriesS)
      last.cues.push(cue);
    else out.push({ t: cue.t, cues: [cue] });
  }
  return out;
}

function sfxChanges(
  ctx: Context,
  recipe: SfxRecipe,
  replace: readonly SoundOccurrence[],
): { changes: RepetitionChange[]; locked: boolean } {
  const changes: RepetitionChange[] = [];
  const history: SfxRecipe[] = [];
  let lockedCount = 0;
  for (const occurrence of replace) {
    const shot = ctx.shotAt(occurrence.t);
    if (shot !== undefined && ctx.locked.has(shot.id)) {
      lockedCount += 1;
      continue;
    }
    const first = occurrence.cues[0];
    if (first === undefined) continue;
    const next = repickSfx(recipe, shot, ctx.lookMode, cueKey(first), history);
    if (next === undefined) continue;
    history.push(next);
    for (const cue of occurrence.cues)
      changes.push({ target: cueKey(cue), from: recipe, to: next });
  }
  return { changes, locked: replace.length > 0 && lockedCount === replace.length };
}

function sfxItem(
  ctx: Context,
  recipe: SfxRecipe,
  occurrences: readonly SoundOccurrence[],
  replace: readonly SoundOccurrence[],
  text: string,
  warning: boolean,
): RepetitionItem {
  const { changes, locked } = sfxChanges(ctx, recipe, replace);
  return item(
    'sfx',
    recipe,
    text,
    occurrences.map((occurrence) => ({
      t: occurrence.t,
      shotId: ctx.shotAt(occurrence.t)?.id,
      cueIds: occurrence.cues.map(cueKey),
    })),
    'sfx',
    changes,
    warning ? 'warning' : 'info',
    locked,
  );
}

export function sfxItems(ctx: Context): RepetitionItem[] {
  const named = (ctx.film.cues ?? [])
    .filter(
      (cue): cue is FilmCue & { name: SfxRecipe } => cue.name !== undefined && isRecipe(cue.name),
    )
    .sort((a, b) => a.t - b.t);
  const { sfxCount, sfxWindowS, sfxSeriesS } = ctx.rules;
  const items: RepetitionItem[] = [];
  const covered = new Set<FilmCue>();
  for (const recipe of [...new Set(named.map((cue) => cue.name))].sort()) {
    const occurrences = soundOccurrences(
      named.filter((cue) => cue.name === recipe),
      sfxSeriesS,
    );
    for (const cluster of clusters(occurrences, sfxCount, sfxWindowS)) {
      for (const occurrence of cluster) for (const cue of occurrence.cues) covered.add(cue);
      items.push(
        sfxItem(
          ctx,
          recipe,
          cluster,
          cluster.filter((_, index) => index % 2 === 1),
          `${recipe} ${String(cluster.length)}× in ${span(cluster)}`,
          cluster.length > sfxCount,
        ),
      );
    }
  }
  // Twice in a row (no other cue between, not a designed series), at any distance.
  named.forEach((cue, index) => {
    const previous = named[index - 1];
    if (previous === undefined || previous.name !== cue.name) return;
    if (cue.t - previous.t < sfxSeriesS || covered.has(cue)) return;
    const pair = [
      { t: previous.t, cues: [previous] },
      { t: cue.t, cues: [cue] },
    ];
    items.push(
      sfxItem(
        ctx,
        cue.name,
        pair,
        pair.slice(1),
        `${cue.name} twice in a row (${fmt(previous.t)}, ${fmt(cue.t)})`,
        cue.t - previous.t <= 5,
      ),
    );
  });
  return items;
}
