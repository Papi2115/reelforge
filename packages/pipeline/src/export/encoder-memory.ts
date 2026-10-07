/**
 * Hardware encoders that failed to open a session during this app session (docs/export.md
 * "Encoder fallback"). `detectEncoder` can probe NVENC fine and the real export still fail to open
 * it (a busy or out-of-memory GPU): the export then restarts on libx264. Without memory every
 * later export would repeat the doomed GPU pass (retries included) first; with it, `detectEncoder`
 * skips a remembered encoder and goes straight to the next one. The memory lives as long as the
 * process that owns it (the app keeps one per session); it is never written to disk.
 */
import type { HardwareEncoderId, VideoEncoderId } from './encoders.js';
import { HARDWARE_ENCODERS } from './encoders.js';

export class EncoderSessionMemory {
  private readonly failures = new Map<HardwareEncoderId, string>();

  /** Remembers that `encoder` could not open a session (`detail`: the ffmpeg line). */
  rememberOpenFailure(encoder: VideoEncoderId, detail: string): void {
    const hardware = HARDWARE_ENCODERS.find((id) => id === encoder);
    if (hardware !== undefined) this.failures.set(hardware, detail);
  }

  /** Encoders to skip in detection, with why (for the probe report). */
  skipped(): ReadonlyMap<VideoEncoderId, string> {
    return new Map(
      [...this.failures].map(([encoder, detail]) => [
        encoder,
        `skipped: could not open earlier this session (${detail})`,
      ]),
    );
  }
}
