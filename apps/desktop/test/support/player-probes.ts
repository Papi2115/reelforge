/**
 * Measurements of the player smoke test (PLAN.md#6.4), taken inside the page so Playwright round
 * trips do not distort them: real-time playback, fps overlay readings and scrub latency (time from
 * a slider input event to the requested frame being drawn into the preview canvas).
 */
import type { ElectronApplication, Page } from 'playwright';

/** Mono 16-bit PCM WAV of `seconds` with a 440 Hz tone at about -60 dBFS. */
export function toneWav(seconds: number, sampleRate = 48_000): Buffer {
  const samples = Math.round(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write('WAVEfmt ', 8, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 33);
    buffer.writeInt16LE(value, 44 + index * 2);
  }
  return buffer;
}

/**
 * 48 kHz 16-bit stereo PCM WAV of `seconds` (the format of a real mix.wav: 192 KB per second) with
 * a quiet 440 Hz tone. One second is computed (440 whole periods) and repeated, so a 15-minute
 * file (≈ 173 MB) is made in well under a second.
 */
export function stereoToneWav(seconds: number): Buffer {
  const sampleRate = 48_000;
  const frameBytes = 4;
  const secondBytes = sampleRate * frameBytes;
  const dataBytes = Math.round(seconds * sampleRate) * frameBytes;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVEfmt ', 8, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(secondBytes, 28);
  buffer.writeUInt16LE(frameBytes, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  const second = Buffer.alloc(secondBytes);
  for (let index = 0; index < sampleRate; index += 1) {
    const value = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 33);
    second.writeInt16LE(value, index * frameBytes);
    second.writeInt16LE(value, index * frameBytes + 2);
  }
  for (let offset = 0; offset < dataBytes; offset += secondBytes) {
    second.copy(buffer, 44 + offset, 0, Math.min(secondBytes, dataBytes - offset));
  }
  return buffer;
}

export interface PlaybackRun {
  /** Seconds of video time advanced during the measurement. */
  readonly advanced: number;
  /** Wall time of the measurement, ms. */
  readonly elapsed: number;
  /** Debug overlay at the end: frames drawn in the last second, dropped frames, engine ms. */
  readonly fps: number;
  readonly dropped: number;
  readonly renderMs: number;
  readonly clock: string;
}

/** Waits for playback to start moving the picture, then measures `ms` of it. */
export function measurePlayback(page: Page, ms: number): Promise<PlaybackRun> {
  return page.evaluate(async (duration) => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.preview-canvas');
    if (!canvas) throw new Error('preview canvas missing');
    const read = (): number => Number(canvas.dataset['renderedT']);
    const nextFrame = (): Promise<void> =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    const initial = read();
    const waitStart = performance.now();
    while (read() === initial && performance.now() - waitStart < 3000) await nextFrame();
    const start = read();
    const startMs = performance.now();
    await new Promise((resolve) => setTimeout(resolve, duration));
    const advanced = read() - start;
    const elapsed = performance.now() - startMs;
    const stats = document.querySelector<HTMLElement>('[data-testid="preview-stats"]')?.dataset;
    const preview = document.querySelector<HTMLElement>('section.preview')?.dataset;
    return {
      advanced,
      elapsed,
      fps: Number(stats?.['fps']),
      dropped: Number(stats?.['dropped']),
      renderMs: Number(stats?.['renderMs']),
      clock: preview?.['clock'] ?? '',
    };
  }, ms);
}

export interface ScrubLatency {
  readonly samples: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
}

/** `count` slider scrubs to distinct frames in [from, to]; latency until each frame is drawn. */
export function measureScrubLatency(
  page: Page,
  count: number,
  range: { readonly from: number; readonly to: number } = { from: 0.2, to: 7.3 },
): Promise<ScrubLatency> {
  return page.evaluate(
    async ({ total, from, to }) => {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Scrub"]');
      const canvas = document.querySelector<HTMLCanvasElement>('canvas.preview-canvas');
      // The prototype setter: React's value tracker must see the change as user input.
      const valueProperty = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (!input || !canvas || !valueProperty) throw new Error('scrub slider or canvas missing');
      const latencies: number[] = [];
      for (let index = 0; latencies.length < total && index < total * 2; index += 1) {
        const target = from + ((index * 0.613) % (to - from));
        valueProperty.set?.call(input, String(Math.round(target * 30) / 30));
        const expected = Number(input.value).toFixed(3);
        if (expected === canvas.dataset['renderedT']) continue;
        const drawn = new Promise<number>((resolve, reject) => {
          const observer = new MutationObserver(() => {
            if (canvas.dataset['renderedT'] !== expected) return;
            observer.disconnect();
            resolve(performance.now());
          });
          observer.observe(canvas, { attributes: true, attributeFilter: ['data-rendered-t'] });
          setTimeout(() => {
            observer.disconnect();
            reject(new Error(`frame ${expected} not drawn within 2 s`));
          }, 2000);
        });
        const start = performance.now();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        latencies.push((await drawn) - start);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      latencies.sort((first, second) => first - second);
      const at = (quantile: number): number =>
        latencies[Math.min(Math.ceil(quantile * latencies.length) - 1, latencies.length - 1)] ?? 0;
      return {
        samples: latencies.length,
        median: at(0.5),
        p95: at(0.95),
        max: latencies.at(-1) ?? 0,
      };
    },
    { total: count, from: range.from, to: range.to },
  );
}

/** Decodes a PNG with Electron's nativeImage (in main); undefined when it is not an image. */
export function pngSizeInMain(
  app: ElectronApplication,
  file: string,
): Promise<{ width: number; height: number } | undefined> {
  return app.evaluate(({ nativeImage }, pngFile) => {
    const image = nativeImage.createFromPath(pngFile);
    return image.isEmpty() ? undefined : image.getSize();
  }, file);
}
