/**
 * Probes of the preview's master audio (PLAN.md#11.1): the hidden `<audio data-testid=
 * "player-audio">` element the player follows, sampled inside the page while the preview plays in
 * real time (no Playwright round trips per sample).
 */
import type { Page } from 'playwright';

export interface MasterAudioSample {
  /** Wall time since the sampling started, ms. */
  readonly at: number;
  readonly src: string;
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly error: string | null;
  readonly readyState: number;
  /** Chromium's decoded byte counter: grows only while audio data is actually decoded. */
  readonly decodedBytes: number;
  /** End of the last buffered range, seconds. */
  readonly bufferedEnd: number;
  /** Time of the preview frame on screen. */
  readonly renderedT: number;
  /** The player's clock source (`section.preview[data-clock]`). */
  readonly clock: string;
}

/**
 * Samples the master audio every `everyMs` until the preview frame reaches `untilT` (or
 * `timeoutMs` passes). The last sample is taken when the condition is met.
 */
export function sampleMasterAudio(
  page: Page,
  options: { readonly untilT: number; readonly timeoutMs: number; readonly everyMs?: number },
): Promise<MasterAudioSample[]> {
  return page.evaluate(
    async ({ untilT, timeoutMs, everyMs }) => {
      const started = performance.now();
      const read = (): MasterAudioSample => {
        const audio = document.querySelector<HTMLAudioElement>('audio[data-testid="player-audio"]');
        const canvas = document.querySelector<HTMLCanvasElement>('canvas.preview-canvas');
        const preview = document.querySelector<HTMLElement>('section.preview');
        const buffered = audio?.buffered;
        const decoded: unknown = audio ? Reflect.get(audio, 'webkitAudioDecodedByteCount') : 0;
        return {
          at: performance.now() - started,
          src: audio?.src ?? '',
          currentTime: audio?.currentTime ?? Number.NaN,
          duration: audio?.duration ?? Number.NaN,
          paused: audio?.paused ?? true,
          error: audio?.error ? `${String(audio.error.code)}: ${audio.error.message}` : null,
          readyState: audio?.readyState ?? 0,
          decodedBytes: typeof decoded === 'number' ? decoded : -1,
          bufferedEnd: buffered && buffered.length > 0 ? buffered.end(buffered.length - 1) : 0,
          renderedT: Number(canvas?.dataset['renderedT']),
          clock: preview?.dataset['clock'] ?? '',
        };
      };
      const samples: MasterAudioSample[] = [];
      for (;;) {
        const sample = read();
        samples.push(sample);
        if (sample.renderedT >= untilT || sample.at >= timeoutMs) return samples;
        await new Promise((resolve) => setTimeout(resolve, everyMs));
      }
    },
    { untilT: options.untilT, timeoutMs: options.timeoutMs, everyMs: options.everyMs ?? 1000 },
  );
}

/** Readout of the master audio right now. */
export async function masterAudio(page: Page): Promise<MasterAudioSample> {
  const [sample] = await sampleMasterAudio(page, { untilT: 0, timeoutMs: 0 });
  if (sample === undefined) throw new Error('no audio sample');
  return sample;
}

/** Problems a playing preview must never show: paused/failed/starving audio, or a system clock. */
export function playbackProblems(samples: readonly MasterAudioSample[]): string[] {
  const problems: string[] = [];
  let previous: MasterAudioSample | undefined;
  for (const sample of samples) {
    const at = `at ${(sample.at / 1000).toFixed(1)} s (t=${sample.currentTime.toFixed(2)})`;
    if (sample.error !== null) problems.push(`${at}: audio error ${sample.error}`);
    if (sample.paused) problems.push(`${at}: audio paused`);
    if (sample.readyState < 2) problems.push(`${at}: readyState ${String(sample.readyState)}`);
    if (sample.clock !== 'audio') problems.push(`${at}: clock ${sample.clock}`);
    if (previous && sample.currentTime <= previous.currentTime) {
      problems.push(`${at}: audio time did not advance`);
    }
    previous = sample;
  }
  return problems;
}
