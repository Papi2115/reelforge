/** Test support: a taste learner (PLAN.md#12.13) keeping the profile in memory, at a fixed time. */
import { emptyTasteProfile, type TasteProfileFile, type TasteSignal } from '@reelforge/shared';
import { applyTasteSignals, tasteProfileText } from '../taste/profile.js';
import type { TasteLearner } from '../taste/signals.js';

export class MemoryTasteLearner implements TasteLearner {
  file: TasteProfileFile = emptyTasteProfile();
  readonly recorded: TasteSignal[] = [];

  constructor(private readonly now: () => Date) {}

  profile(): string | undefined {
    return tasteProfileText(this.file, this.now());
  }

  record(signals: readonly TasteSignal[]): void {
    this.recorded.push(...signals);
    this.file = applyTasteSignals(this.file, signals, this.now());
  }

  /** "Forget everything". */
  reset(): void {
    this.file = emptyTasteProfile();
  }
}
