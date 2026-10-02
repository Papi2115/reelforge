/**
 * The live view of the running stage (PLAN.md#6.8): step label + percent, the usage-limit pause
 * and Claude's steps across all turns of the run (each turn reduced by the bridge's `steps`
 * reducer, converted like the chat's step log). Fed with the StageRunner's events.
 */
import { initialTurnView, reduceTurn, type TurnView } from '@reelforge/claude-bridge';
import type { PipelineStage, StageEvent } from '@reelforge/stages';
import type { ChatStep } from '../../shared/chat-contract.js';
import type { StageRunView } from '../../shared/stages-contract.js';
import { toChatSteps } from '../claude/chat-steps.js';

/** Older steps are dropped beyond this (a long stage must not grow the push without bound). */
export const MAX_RUN_STEPS = 300;

export class StageRun {
  private label: string | null = null;
  private percent: number | null = null;
  private paused: StageRunView['paused'] = null;
  private finishedSteps: ChatStep[] = [];
  private view: TurnView = initialTurnView();
  private turn = 0;
  readonly warnings: string[] = [];

  constructor(
    readonly stage: PipelineStage,
    readonly projectDir: string,
    readonly startedAt: number,
  ) {}

  /** Applies a runner event; true when the view changed. */
  apply(event: StageEvent): boolean {
    switch (event.type) {
      case 'step':
        this.label = event.label;
        if (event.percent !== undefined) this.percent = clampPercent(event.percent);
        if (event.label.startsWith('Claude')) this.nextTurn();
        return true;
      case 'claude':
        this.view = reduceTurn(this.view, event.event);
        return true;
      case 'paused':
        this.paused = {
          until: event.until === undefined ? null : Date.parse(event.until),
          message: event.message,
        };
        return true;
      case 'resumed':
        this.paused = null;
        return true;
      case 'warning':
        this.warnings.push(event.message);
        return true;
      default:
        // started / committed / done / failed: the service re-reads the project instead.
        return false;
    }
  }

  snapshot(): StageRunView {
    const current = this.turnSteps();
    const steps = [...this.finishedSteps, ...current].slice(-MAX_RUN_STEPS);
    return {
      stage: this.stage,
      label: this.label,
      percent: this.percent,
      startedAt: this.startedAt,
      steps,
      paused: this.paused,
    };
  }

  private nextTurn(): void {
    const current = this.turnSteps();
    if (current.length > 0) {
      this.finishedSteps = [...this.finishedSteps, ...current].slice(-MAX_RUN_STEPS);
    }
    this.view = initialTurnView();
    this.turn += 1;
  }

  /** Steps of the current turn; ids are prefixed with the turn number (unique across turns). */
  private turnSteps(): ChatStep[] {
    const prefix = `t${String(this.turn)}-`;
    return toChatSteps(this.view, this.projectDir).map((step) => ({
      ...step,
      id: `${prefix}${step.id}`,
    }));
  }
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
