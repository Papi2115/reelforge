import { describe, expect, it } from 'vitest';
import { TransferMeter } from './transfer-meter.js';

describe('TransferMeter', () => {
  it('needs half a second of history, then gives speed and time left', () => {
    const meter = new TransferMeter();
    expect(meter.sample(0, 0, 10_000_000)).toEqual({ bytesPerSecond: null, etaS: null });
    expect(meter.sample(400, 400_000, 10_000_000).bytesPerSecond).toBeNull();
    expect(meter.sample(1_000, 1_000_000, 10_000_000)).toEqual({
      bytesPerSecond: 1_000_000,
      etaS: 9,
    });
  });

  it('follows the recent speed (sliding window) and has no ETA while stalled', () => {
    const meter = new TransferMeter();
    meter.sample(0, 0, 100_000_000);
    meter.sample(5_000, 50_000_000, 100_000_000);
    meter.sample(10_000, 50_000_000, 100_000_000);
    const stalled = meter.sample(11_000, 50_000_000, 100_000_000);
    expect(stalled.bytesPerSecond).toBe(0);
    expect(stalled.etaS).toBeNull();
  });
});
