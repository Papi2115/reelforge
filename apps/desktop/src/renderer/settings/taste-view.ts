/**
 * Settings → Taste view model (PLAN.md#12.13): the status line of the profile, the preference
 * bars (lean −1 … +1 drawn from the middle), the decisions recorded, and which channel / world
 * profile is shown (PLAN.md#13.13). Pure.
 */
import type { TasteScopeView, TasteState } from '../../shared/taste-contract.js';
import { plural } from '../../shared/plural.js';
import { styleLabel } from '../../shared/style-choices.js';

type OkState = Extract<TasteState, { status: 'ok' }>;

export interface PreferenceBar {
  readonly side: 'like' | 'dislike';
  /** Share of the whole bar, 0–50 (the bar is centred). */
  readonly widthPercent: number;
  /** `+75` / `−40`: the lean in percent. */
  readonly text: string;
  /** Read out instead of the bar. */
  readonly description: string;
}

export function preferenceBar(label: string, strength: number): PreferenceBar {
  const percent = Math.round(Math.abs(strength) * 100);
  const like = strength >= 0;
  return {
    side: like ? 'like' : 'dislike',
    widthPercent: percent / 2,
    text: `${like ? '+' : '−'}${String(percent)}`,
    description: `${like ? 'Prefers' : 'Turns down'} ${label}: ${String(percent)} %`,
  };
}

export function signalSummary(signals: OkState['signals']): string {
  return [
    plural(signals.pick, 'variant pick'),
    plural(signals.keep, 'current scene kept', 'current scenes kept'),
    plural(signals.discard, 'set discarded', 'sets discarded'),
    plural(signals.lock, 'lock'),
    plural(signals.rebuild, 'rebuild'),
  ].join(' · ');
}

export function totalSignals(signals: OkState['signals']): number {
  return signals.pick + signals.keep + signals.discard + signals.lock + signals.rebuild;
}

/** One line under the profile: why there is (no) profile in the prompts. */
export function profileStatus(state: OkState): string {
  if (state.learning === 'off') {
    return 'Taste learning is off for this channel: nothing is recorded and the prompts stay exactly as they are.';
  }
  const total = totalSignals(state.signals);
  if (total < state.minSignals) {
    return `Learning: ${plural(total, 'decision')} so far, the profile is used from ${String(state.minSignals)} on.`;
  }
  if (state.profile === null) {
    return 'Learning: no clear preference yet, so the prompts are unchanged.';
  }
  return 'The storyboard and scene prompts get this profile as a soft preference.';
}

/** "Crime" / "Crime · Comic": the profile shown (channels.json unreadable: the default channel's). */
export function scopeTitle(scope: TasteScopeView): string {
  const channel = scope.channelName ?? 'Default channel';
  return scope.world === null ? channel : `${channel} · ${styleLabel(scope.world)}`;
}

/** One line under the title: where the profile comes from and what it covers. */
export function scopeNote(scope: TasteScopeView): string {
  if (scope.channelId === null) {
    return 'The channel list cannot be read, so the profile of the default channel is shown.';
  }
  const covers = scope.perWorld
    ? 'This channel keeps a separate profile for each world.'
    : 'Every film of this channel learns and uses this profile.';
  return scope.fromProject
    ? `The channel of the open project. ${covers}`
    : `No project is open: pick a channel. ${covers}`;
}

/** The worlds offered in the world picker (the shown one is always included). */
export function worldChoices(scope: TasteScopeView): { id: string; label: string }[] {
  return scope.worlds.map((id) => ({ id, label: styleLabel(id) }));
}
