/**
 * The "Needs you" inbox (docs/ux/redesign-2.4.md §2.3, U7): everything in the open project that
 * waits for the user, collected from what the app already reads — the step statuses
 * (stations-view.ts: the brief, the script to approve, the voiceover to record, failed, stopped
 * and out-of-date steps), the shots the final review / scenes report flag (✗ / ⚠, the export
 * pre-flight), the asset packages to review, the words alignment, the claims without a source,
 * the wow moments and open questions (dramaturgy) and the open repetitions (editing). Every item is
 * one plain sentence and one button that goes there; an item disappears once its source no longer
 * reports it. Decisions first, then problems, then checks, then out-of-date steps. Pure.
 */
import type { WordsReport } from '@reelforge/shared';
import { plural } from '../../shared/plural.js';
import type { AssetsState } from '../../shared/assets-contract.js';
import type { DramaturgyState } from '../../shared/dramaturgy-contract.js';
import type { EditingState } from '../../shared/editing-contract.js';
import type { ClaimsState } from '../../shared/publish-contract.js';
import type { StagesState } from '../../shared/stages-contract.js';
import type { PreflightItem } from './final-review-view.js';
import { pipelineRows, type OpenTarget, type RowView } from './pipeline-view.js';
import { sentence, stations, type StationFacts, type StationView } from './stations-view.js';
import { wordsNeedWhisper } from './words-setup.js';

/** Where an item's button goes (layout/open-stage.ts openAttentionTarget). */
export type AttentionTarget =
  | { readonly kind: 'brief' }
  | { readonly kind: 'open'; readonly target: Exclude<OpenTarget, { kind: 'artifact' }> }
  /** Script → Sources. */
  | { readonly kind: 'sources' }
  /** The step selected in the pipeline (its Retry / Run / Resume show under the list). */
  | { readonly kind: 'step'; readonly rowId: string }
  | { readonly kind: 'shot'; readonly shotId: string; readonly t: number }
  | { readonly kind: 'director'; readonly section: 'beats' | 'editing' }
  /** A film of the production line, shown in the Production line dialog (PLAN.md#13.9). */
  | { readonly kind: 'line'; readonly channelId: string; readonly itemId: string };

export type AttentionGroup = 'decision' | 'problem' | 'check' | 'out-of-date';

export interface AttentionItem {
  /** Stable while the item stays (list key, tests). */
  readonly id: string;
  readonly group: AttentionGroup;
  /** What it is about ("Script written", "Sources", "Scenes built"). */
  readonly subject: string;
  readonly text: string;
  /** The full line behind a shortened `text` (the item's tooltip). */
  readonly detail?: string;
  /** Names the action ("Open the script", "Show s02"). */
  readonly button: string;
  readonly target: AttentionTarget;
}

export interface AttentionInput {
  readonly state: StagesState | undefined;
  readonly facts?: StationFacts | undefined;
  /** The ⚠ / ✗ shots (final-review-view.ts exportPreflight). */
  readonly shots?: readonly PreflightItem[] | undefined;
  readonly words?: WordsReport | null | undefined;
  readonly assets?: AssetsState | undefined;
  readonly dramaturgy?: DramaturgyState | undefined;
  readonly editing?: EditingState | undefined;
  readonly claims?: ClaimsState | undefined;
}

/** Below this share of the script heard the timing needs a look (the words stage's retry bar). */
export const POOR_ALIGNMENT = 0.85;

const GROUP_ORDER: readonly AttentionGroup[] = ['decision', 'problem', 'check', 'out-of-date'];

const OPEN_SCRIPT: AttentionTarget = { kind: 'open', target: { kind: 'script' } };

function stepButton(row: RowView): string {
  return `Show ${row.spec.label}`;
}

/** The user's turn on a step: the brief, the script to approve, the voiceover to add. */
function decisionItem(row: RowView, view: StationView): AttentionItem | undefined {
  const base = { group: 'decision', subject: row.spec.label, text: view.sentence } as const;
  if (row.spec.id === 'script') {
    return row.status === 'review'
      ? { ...base, id: 'script-review', button: 'Open the script', target: OPEN_SCRIPT }
      : { ...base, id: 'brief', button: 'Open the brief', target: { kind: 'brief' } };
  }
  if (row.spec.id === 'voiceover') {
    return {
      ...base,
      id: 'voiceover',
      button: 'Add your voiceover',
      target: { kind: 'open', target: { kind: 'voiceover' } },
    };
  }
  if (row.spec.id === 'assets') {
    return {
      ...base,
      id: 'photos',
      button: 'Review photos',
      target: { kind: 'open', target: { kind: 'assets' } },
    };
  }
  return undefined;
}

function whisperItem(): AttentionItem {
  return {
    id: 'whisper',
    group: 'problem',
    subject: 'Words timed',
    text: 'Word timing needs the transcription engine (whisper.cpp): a one-time download.',
    button: 'Set up word timing',
    target: { kind: 'step', rowId: 'words' },
  };
}

function stepItem(row: RowView, view: StationView, shotsFlagged: boolean): AttentionItem[] {
  if (view.status === 'needs-you') {
    const item = decisionItem(row, view);
    return item === undefined ? [] : [item];
  }
  if (row.spec.id === 'words' && wordsNeedWhisper(row.error)) return [whisperItem()];
  const step = { subject: row.spec.label, text: view.sentence, button: stepButton(row) };
  const target: AttentionTarget = { kind: 'step', rowId: row.spec.id };
  if (view.status === 'failed' || view.status === 'problems' || row.status === 'interrupted') {
    // Scenes with flagged shots: the shots are the items (one per shot, each goes there).
    if (row.spec.id === 'scenes' && view.status === 'problems' && shotsFlagged) return [];
    return [{ id: `step:${row.spec.id}`, group: 'problem', ...step, target }];
  }
  if (view.status === 'out-of-date') {
    return [{ id: `stale:${row.spec.id}`, group: 'out-of-date', ...step, target }];
  }
  return [];
}

/** "legibility: scenes/s02.js:52 … (+1 more)" -> "legibility (+1 more)": the finding's kind. */
function findingKind(text: string): string {
  const match = /^([^:]{1,40}): .*?( \(\+\d+ more\))?$/su.exec(text);
  return match === null ? text : `${match[1] ?? ''}${match[2] ?? ''}`;
}

function shotItem(item: PreflightItem): AttentionItem {
  const who = item.locked ? `${item.shotId} (locked)` : item.shotId;
  const what = item.status === 'failed' ? 'failed' : 'needs a look';
  // Without a finding the preflight line is just "needs a look": nothing to add.
  const kind = item.text === 'needs a look' ? null : findingKind(item.text);
  return {
    id: `shot:${item.shotId}`,
    group: 'problem',
    subject: 'Scenes built',
    text: sentence(`${item.symbol} ${who} ${what}${kind === null ? '' : `: ${kind}`}`),
    ...(kind === null || kind === item.text ? {} : { detail: item.text }),
    button: `Show ${item.shotId}`,
    target: { kind: 'shot', shotId: item.shotId, t: item.t },
  };
}

/** Asset packages waiting for a review (replaces the Assets step's own "Needs you" item). */
function photosItem(assets: AssetsState | undefined): AttentionItem | undefined {
  if (assets?.status !== 'ok' || assets.pending.length === 0) return undefined;
  const count = assets.pending.reduce((sum, proposal) => sum + proposal.items.length, 0);
  const items = plural(count, 'photo or clip', 'photos and clips');
  const [only] = assets.pending;
  const where =
    assets.pending.length === 1 && only !== undefined
      ? `Asset package ${String(only.number)}`
      : plural(assets.pending.length, 'asset package');
  return {
    id: 'photos',
    group: 'decision',
    subject: 'Assets',
    text: `${where}: ${items} to approve or reject.`,
    button: 'Review photos',
    target: { kind: 'open', target: { kind: 'assets' } },
  };
}

function alignmentItem(words: WordsReport | null | undefined): AttentionItem | undefined {
  if (words === null || words === undefined || words.coverage >= POOR_ALIGNMENT) return undefined;
  const percent = Math.round(words.coverage * 100);
  return {
    id: 'alignment',
    group: 'check',
    subject: 'Words timed',
    text: `Only ${String(percent)} % of the script was heard in the recording: check the word timing.`,
    button: 'Open the words',
    target: { kind: 'open', target: { kind: 'words' } },
  };
}

function claimsItem(claims: ClaimsState | undefined): AttentionItem | undefined {
  if (claims?.status !== 'ok' || claims.file === null) return undefined;
  const count = claims.file.claims.filter((claim) => claim.status === 'unsourced').length;
  if (count === 0) return undefined;
  return {
    id: 'claims',
    group: 'check',
    subject: 'Sources',
    text: `${plural(count, 'claim')} in the script ${count === 1 ? 'has' : 'have'} no source.`,
    button: 'Open sources',
    target: { kind: 'sources' },
  };
}

const IN_DIRECTOR = 'Open in Director';

function dramaturgyItems(state: DramaturgyState | undefined): AttentionItem[] {
  if (state?.status !== 'ok') return [];
  const items: AttentionItem[] = [];
  const proposed = state.moments.filter((view) => view.moment.status === 'proposed').length;
  if (state.switches.revealMoments !== 'off' && proposed > 0) {
    items.push({
      id: 'moments',
      group: 'check',
      subject: 'Story beats',
      text: `${plural(proposed, 'wow moment')} to accept or reject.`,
      button: IN_DIRECTOR,
      target: { kind: 'director', section: 'beats' },
    });
  }
  const unanswered = state.report?.loops?.warnings.length ?? 0;
  if (state.switches.openLoops !== 'off' && unanswered > 0) {
    items.push({
      id: 'loops',
      group: 'check',
      subject: 'Story beats',
      text: `${plural(unanswered, 'question')} in the film ${unanswered === 1 ? 'is' : 'are'} never answered.`,
      button: IN_DIRECTOR,
      target: { kind: 'director', section: 'beats' },
    });
  }
  return items;
}

function repetitionItem(state: EditingState | undefined): AttentionItem | undefined {
  if (state?.status !== 'ok' || state.switches.repetitionControl === 'off') return undefined;
  const open = (state.repetitions?.items ?? []).filter((item) => item.status === 'open');
  const [first] = open;
  if (first === undefined) return undefined;
  const more = open.length > 1 ? ` (+${String(open.length - 1)} more)` : '';
  return {
    id: 'repetition',
    group: 'check',
    subject: 'Editing',
    text: sentence(`Too much of the same: ${first.text}${more}`),
    button: IN_DIRECTOR,
    target: { kind: 'director', section: 'editing' },
  };
}

/** Everything that waits for the user, most important first; [] when nothing does. */
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const rows = pipelineRows(input.state);
  const views = stations(rows, input.state, input.facts ?? {});
  const flagged = input.shots ?? [];
  const photos = photosItem(input.assets);
  const steps = rows.flatMap((row, index) => {
    const view = views[index];
    if (view === undefined || view.status === null) return [];
    // The packages themselves say more than the Assets step's "Needs you".
    if (row.spec.id === 'assets' && row.status === 'review' && photos !== undefined) return [];
    return stepItem(row, view, flagged.length > 0);
  });
  const all = [
    ...steps,
    ...(photos === undefined ? [] : [photos]),
    ...flagged.map(shotItem),
    ...[alignmentItem(input.words), claimsItem(input.claims)].filter(isItem),
    ...dramaturgyItems(input.dramaturgy),
    ...[repetitionItem(input.editing)].filter(isItem),
  ];
  return GROUP_ORDER.flatMap((group) => all.filter((item) => item.group === group));
}

function isItem(item: AttentionItem | undefined): item is AttentionItem {
  return item !== undefined;
}

/** The header button's accessible count ("Needs you: 2 items" / "Needs you: nothing"). */
export function attentionLabel(count: number): string {
  return count === 0 ? 'Needs you: nothing' : `Needs you: ${plural(count, 'item')}`;
}

/** Announced (politely) when the count changes. */
export function attentionAnnouncement(count: number): string {
  return count === 0
    ? 'Nothing needs you right now.'
    : `${plural(count, 'thing')} ${count === 1 ? 'needs' : 'need'} you.`;
}

export const ATTENTION_EMPTY = 'Nothing needs you right now.';
