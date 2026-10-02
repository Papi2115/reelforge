/**
 * Download speed and time left for the install progress: bytes over a sliding window of recent
 * samples (so a stall shows up within seconds), the remaining bytes divided by that speed.
 */
export interface TransferEstimate {
  readonly bytesPerSecond: number | null;
  readonly etaS: number | null;
}

interface Sample {
  readonly at: number;
  readonly bytes: number;
}

const WINDOW_MS = 5_000;
/** Below this much history the speed is too noisy to show. */
const MIN_SPAN_MS = 500;

export class TransferMeter {
  private samples: Sample[] = [];

  /** `now` in ms (monotonic), `receivedBytes` of the whole job so far. */
  sample(now: number, receivedBytes: number, totalBytes: number): TransferEstimate {
    this.samples.push({ at: now, bytes: receivedBytes });
    while (this.samples.length > 2 && now - (this.samples[1]?.at ?? now) >= WINDOW_MS) {
      this.samples.shift();
    }
    const first = this.samples[0];
    if (first === undefined) return { bytesPerSecond: null, etaS: null };
    const span = now - first.at;
    if (span < MIN_SPAN_MS) return { bytesPerSecond: null, etaS: null };
    const bytesPerSecond = Math.max(0, ((receivedBytes - first.bytes) / span) * 1000);
    const remaining = Math.max(0, totalBytes - receivedBytes);
    return {
      bytesPerSecond,
      etaS: bytesPerSecond > 0 ? Math.ceil(remaining / bytesPerSecond) : null,
    };
  }
}
