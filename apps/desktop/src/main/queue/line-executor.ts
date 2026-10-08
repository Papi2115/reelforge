/**
 * The app's step executor of the production line (PLAN.md#13.9): the line's StageQueueExecutor
 * (the app's StageRunners, pipeline.json store, Claude, export and publish kit) with what only the
 * app knows around it — before a step that renders (scene build, final review, export) the line's
 * render service and export follow the film, so Claude's `reelforge` commands in that project
 * reach a render service like in an open project; before the voiceover step the channel's voice
 * setup is read again (a key saved meanwhile counts), and the voice progress goes to the step's
 * live line.
 */
import type {
  ExecutorStep,
  QueueStepContext,
  QueueStepExecutor,
  VoiceProvider,
} from '@reelforge/stages';
import type { VoiceProgress } from '../../shared/voice-contract.js';

const RENDER_STEPS: ReadonlySet<ExecutorStep> = new Set(['scenes', 'final-review', 'export']);

export interface LineExecutorOptions {
  /** Points the line's render service (and export) at the film. */
  readonly follow: (projectDir: string) => Promise<void>;
  /** The channel generates its voiceovers (voice + key); read before every voiceover step. */
  readonly voiceReady: (channelId: string) => Promise<boolean>;
}

/**
 * Builds the executor around the inner one (`create` gets the `voiceFor` it must use, so the
 * channels' voice readiness stays in one place).
 */
export class LineExecutor implements QueueStepExecutor {
  private readonly readyVoices = new Set<string>();
  private voiceStep: QueueStepContext | undefined;
  private readonly inner: QueueStepExecutor;

  constructor(
    private readonly options: LineExecutorOptions,
    provider: VoiceProvider,
    create: (voiceFor: (channelId: string) => VoiceProvider | undefined) => QueueStepExecutor,
  ) {
    this.inner = create((channelId) => (this.readyVoices.has(channelId) ? provider : undefined));
  }

  async run(step: ExecutorStep, ctx: QueueStepContext): ReturnType<QueueStepExecutor['run']> {
    if (RENDER_STEPS.has(step)) await this.options.follow(ctx.projectDir);
    if (step !== 'voiceover') return this.inner.run(step, ctx);
    if (await this.options.voiceReady(ctx.channelId)) this.readyVoices.add(ctx.channelId);
    else this.readyVoices.delete(ctx.channelId);
    this.voiceStep = ctx;
    try {
      return await this.inner.run(step, ctx);
    } finally {
      this.voiceStep = undefined;
    }
  }

  approveScript(projectDir: string): ReturnType<QueueStepExecutor['approveScript']> {
    return this.inner.approveScript(projectDir);
  }

  /** The line's VoiceService progress, shown as the voiceover step's live line. */
  voiceProgress(progress: VoiceProgress): void {
    const step = this.voiceStep;
    if (step === undefined || progress.finished) return;
    if (progress.phase === 'importing') {
      step.progress('Voice made: taking it in');
      return;
    }
    const percent = progress.total === 0 ? undefined : (100 * progress.done) / progress.total;
    const note = progress.note === null ? '' : ` · ${progress.note}`;
    const done =
      progress.total === 0
        ? 'checking the ElevenLabs account'
        : `${String(progress.done)} of ${String(progress.total)} paragraphs`;
    step.progress(`Generating the voice: ${done}${note}`, percent);
  }
}
