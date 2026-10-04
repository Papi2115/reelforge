/**
 * Film-level repetition analysis (PLAN.md#12.23, pure, read-only): `findRepetitions` looks over
 * the whole film for (a) the same visual signature (look + treatment + kit definitions) within
 * 45 s and the same chart/template 3+ times a minute, (b) the same transition style twice within
 * 20 s, (c) the same SFX recipe 3+ times in 30 s or twice in a row, (d) the same narration phrase
 * (3+ words) 3+ times in a minute — thresholds configurable — and proposes replacements
 * (`proposals.ts`) that never touch a locked shot. It changes nothing; `apply.ts` does, on request.
 */
import { SFX_RECIPES, type SfxRecipe } from '@reelforge/pipeline';
import {
  DEFAULT_REPETITION_THRESHOLDS,
  REPETITIONS_VERSION,
  type LookMode,
  type RepetitionChange,
  type RepetitionItem,
  type RepetitionKind,
  type RepetitionThresholds,
  type RepetitionsFile,
  type StoryboardShot,
} from '@reelforge/shared';
import type { DirectorWord } from '../sound/cue-events.js';
import { clusters } from './clusters.js';
import { findRepeatedPhrases } from './phrases.js';
import { repickSfx, repickTransition, transitionStyleOf, variantHint } from './proposals.js';
import { isTemplateDefinition, kitDefinitions, visualSignature } from './signature.js';

export interface FilmCue {
  readonly id?: string | undefined;
  readonly t: number;
  readonly name?: string | undefined;
}

export interface RepetitionFilm {
  readonly shots: readonly StoryboardShot[];
  /** Scene source per shot id (static scan); a missing source = no visual signature. */
  readonly sources?: ReadonlyMap<string, string> | undefined;
  /** cues.json sfx. */
  readonly cues?: readonly FilmCue[] | undefined;
  readonly words?: readonly DirectorWord[] | undefined;
  readonly locked?: ReadonlySet<string> | undefined;
  readonly lookMode?: LookMode | undefined;
  /** Project seed (transition re-picks). */
  readonly seed?: number | undefined;
}

interface Occurrence {
  readonly t: number;
  readonly shotId?: string | undefined;
  readonly cueIds?: readonly string[] | undefined;
}

const fmt = (t: number): string => `${t.toFixed(1)} s`;
const isRecipe = (name: string): name is SfxRecipe =>
  (SFX_RECIPES as readonly string[]).includes(name);

export function cueKey(cue: FilmCue): string {
  return cue.id ?? `t${String(Math.round(cue.t * 1000))}`;
}

interface Context {
  readonly film: RepetitionFilm;
  readonly rules: RepetitionThresholds;
  readonly locked: ReadonlySet<string>;
  readonly lookMode: LookMode;
  shotAt(t: number): StoryboardShot | undefined;
}

function item(
  kind: RepetitionKind,
  subject: string,
  text: string,
  occurrences: readonly Occurrence[],
  action: RepetitionItem['action'],
  changes: readonly RepetitionChange[],
  severity: RepetitionItem['severity'],
  lockedTargets: boolean,
): RepetitionItem {
  const first = occurrences[0];
  return {
    id: `${kind}:${subject}@${(first?.t ?? 0).toFixed(2)}`,
    kind,
    severity,
    subject,
    text,
    occurrences: occurrences.map((occurrence) => ({
      t: Math.round(occurrence.t * 1000) / 1000,
      ...(occurrence.shotId === undefined ? {} : { shotId: occurrence.shotId }),
      ...(occurrence.cueIds?.[0] === undefined ? {} : { cueId: occurrence.cueIds[0] }),
    })),
    action,
    changes: [...changes],
    locked: lockedTargets,
    status: 'open',
  };
}

const span = (occurrences: readonly { t: number }[]): string =>
  `${fmt(occurrences[0]?.t ?? 0)}–${fmt(occurrences.at(-1)?.t ?? 0)}`;

function visualItems(ctx: Context): RepetitionItem[] {
  const { shots } = ctx.film;
  const definitions = new Map(
    shots.map((shot) => {
      const source = ctx.film.sources?.get(shot.id);
      return [shot.id, source === undefined ? undefined : kitDefinitions(source)] as const;
    }),
  );
  const items: RepetitionItem[] = [];
  const bySignature = new Map<string, StoryboardShot[]>();
  for (const shot of shots) {
    const signature = visualSignature({ shot, definitions: definitions.get(shot.id) });
    if (signature !== undefined)
      bySignature.set(signature, [...(bySignature.get(signature) ?? []), shot]);
  }
  for (const [signature, group] of bySignature) {
    for (const cluster of clusters(
      group.map((shot) => ({ t: shot.t0, shot })),
      2,
      ctx.rules.visualWindowS,
    )) {
      const adjacent = cluster.some(
        (entry, index) =>
          index > 0 &&
          shots.indexOf(entry.shot) === shots.indexOf(cluster[index - 1]?.shot ?? entry.shot) + 1,
      );
      items.push(variantItem(ctx, 'visual', signature, cluster, cluster.length >= 3 || adjacent));
    }
  }
  const templates = new Map<string, StoryboardShot[]>();
  for (const shot of shots) {
    for (const definition of definitions.get(shot.id) ?? []) {
      if (isTemplateDefinition(definition)) {
        templates.set(definition, [...(templates.get(definition) ?? []), shot]);
      }
    }
  }
  for (const [definition, group] of templates) {
    for (const cluster of clusters(
      group.map((shot) => ({ t: shot.t0, shot })),
      ctx.rules.templateCount,
      ctx.rules.templateWindowS,
    )) {
      items.push(
        variantItem(ctx, 'template', definition, cluster, cluster.length > ctx.rules.templateCount),
      );
    }
  }
  return items;
}

function variantItem(
  ctx: Context,
  kind: 'visual' | 'template',
  subject: string,
  cluster: readonly { t: number; shot: StoryboardShot }[],
  warning: boolean,
): RepetitionItem {
  const first = cluster[0];
  const later = cluster.slice(1);
  const changes = later
    .filter((entry) => !ctx.locked.has(entry.shot.id))
    .map((entry) => ({
      target: entry.shot.id,
      from: subject,
      to: variantHint(
        kind === 'template' ? `the same template (${subject})` : subject,
        first?.shot.id ?? '',
        first?.t ?? 0,
      ),
    }));
  const label = kind === 'visual' ? 'the same visual' : `template ${subject}`;
  const text = `${label} ${String(cluster.length)}× in ${span(cluster)} (${cluster.map((entry) => entry.shot.id).join(', ')})`;
  return item(
    kind,
    subject,
    text,
    cluster.map((entry) => ({ t: entry.t, shotId: entry.shot.id })),
    'variant',
    changes,
    warning ? 'warning' : 'info',
    later.length > 0 && later.every((entry) => ctx.locked.has(entry.shot.id)),
  );
}

function transitionItems(ctx: Context): RepetitionItem[] {
  const { shots } = ctx.film;
  const all = shots.flatMap((shot, index) => {
    const style = transitionStyleOf(shot.transitionIn);
    const previous = shots[index - 1];
    return style === undefined || previous === undefined
      ? []
      : [{ t: shot.t0, shot, previous, style }];
  });
  const byStyle = new Map<string, typeof all>();
  for (const entry of all) byStyle.set(entry.style, [...(byStyle.get(entry.style) ?? []), entry]);
  const items: RepetitionItem[] = [];
  for (const [style, group] of byStyle) {
    for (const cluster of clusters(group, 2, ctx.rules.transitionWindowS)) {
      const later = cluster.slice(1);
      const changes = later.flatMap((entry): RepetitionChange[] => {
        if (ctx.locked.has(entry.shot.id)) return [];
        const near = all
          .filter(
            (other) =>
              other !== entry && Math.abs(other.t - entry.t) <= ctx.rules.transitionWindowS,
          )
          .map((other) => other.style);
        const next = repickTransition(
          entry.shot,
          entry.previous,
          ctx.lookMode,
          ctx.film.seed ?? 0,
          [...near.filter((other) => other !== style), style],
        );
        const to = transitionStyleOf(next);
        return to === undefined ? [] : [{ target: entry.shot.id, from: style, to }];
      });
      const closest = Math.min(
        ...cluster.slice(1).map((entry, index) => entry.t - (cluster[index]?.t ?? 0)),
      );
      items.push(
        item(
          'transition',
          style,
          `transition ${style} ${String(cluster.length)}× in ${span(cluster)} (${cluster.map((entry) => entry.shot.id).join(', ')})`,
          cluster.map((entry) => ({ t: entry.t, shotId: entry.shot.id })),
          'transition',
          changes,
          closest <= ctx.rules.transitionWindowS / 2 ? 'warning' : 'info',
          later.every((entry) => ctx.locked.has(entry.shot.id)),
        ),
      );
    }
  }
  return items;
}

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

function sfxItems(ctx: Context): RepetitionItem[] {
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

function phraseItems(ctx: Context): RepetitionItem[] {
  return findRepeatedPhrases(ctx.film.words ?? [], ctx.rules).map((found) =>
    item(
      'phrase',
      found.phrase,
      `"${found.phrase}" ${String(found.occurrences.length)}× in ${span(found.occurrences)}`,
      found.occurrences.map((occurrence) => ({
        t: occurrence.t,
        shotId: ctx.shotAt(occurrence.t)?.id,
      })),
      'none',
      [],
      found.occurrences.length > ctx.rules.phraseCount ? 'warning' : 'info',
      false,
    ),
  );
}

/** The repetitions of a film (see the module comment); every item `open`. */
export function findRepetitions(
  film: RepetitionFilm,
  thresholds: Partial<RepetitionThresholds> = {},
): RepetitionsFile {
  const rules = { ...DEFAULT_REPETITION_THRESHOLDS, ...thresholds };
  const ctx: Context = {
    film,
    rules,
    locked: film.locked ?? new Set(),
    lookMode: film.lookMode ?? 'voxel-only',
    shotAt: (t) => film.shots.find((shot) => t >= shot.t0 && t < shot.t1) ?? film.shots.at(-1),
  };
  const items = [
    ...visualItems(ctx),
    ...transitionItems(ctx),
    ...sfxItems(ctx),
    ...phraseItems(ctx),
  ].sort(
    (a, b) => (a.occurrences[0]?.t ?? 0) - (b.occurrences[0]?.t ?? 0) || a.id.localeCompare(b.id),
  );
  return { version: REPETITIONS_VERSION, thresholds: rules, items, counts: countItems(items) };
}

export function countItems(items: readonly RepetitionItem[]): RepetitionsFile['counts'] {
  const of = (kind: RepetitionKind): number => items.filter((entry) => entry.kind === kind).length;
  return {
    visual: of('visual'),
    template: of('template'),
    transition: of('transition'),
    sfx: of('sfx'),
    phrase: of('phrase'),
    open: items.filter((entry) => entry.status === 'open').length,
  };
}
