/**
 * Microphone access for the in-app voice-over recording (PLAN.md#7.2), and nothing else: every
 * permission stays denied (security.ts) except an audio-only `media` request from the main frame
 * of the app's own origin, and only within a few seconds after the user clicked Record (the click
 * sends `micArm`). Camera, screen capture, other origins and the sandboxed engine frame are always
 * refused. Pure decisions + a small stateful gate, so the policy is unit-tested without Electron.
 */
import { originOf } from './navigation-policy.js';

/** How long a Record click keeps the next microphone request allowed. */
export const MIC_ARM_MS = 15_000;

/** Permission names Chromium uses for microphone capture. */
const MIC_PERMISSIONS = new Set(['media', 'audioCapture']);

export interface MicRequest {
  readonly permission: string;
  /** `details.mediaTypes` of Electron's request handler (empty/undefined = unknown). */
  readonly mediaTypes: readonly string[] | undefined;
  readonly requestingUrl: string;
  readonly isMainFrame: boolean;
}

export interface MicCheck {
  readonly permission: string;
  /** `details.mediaType` of Electron's check handler. */
  readonly mediaType: string | undefined;
  readonly requestingOrigin: string;
}

export class MicPermissionGate {
  private armedUntil = 0;
  private granted = false;

  constructor(
    private readonly appOrigin: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** The user clicked Record (IPC from the app window). */
  arm(): void {
    this.armedUntil = this.now() + MIC_ARM_MS;
  }

  /** Permission request: audio only, app origin, main frame, armed by a click. */
  request(request: MicRequest): boolean {
    if (!MIC_PERMISSIONS.has(request.permission) || !request.isMainFrame) return false;
    if (originOf(request.requestingUrl) !== this.appOrigin) return false;
    const types = request.mediaTypes ?? [];
    if (types.length === 0 || types.some((type) => type !== 'audio')) return false;
    if (this.now() > this.armedUntil) return false;
    this.armedUntil = 0;
    this.granted = true;
    return true;
  }

  /**
   * Permission check (device labels, `permissions.query`): true only for audio on the app origin
   * after a request was granted in this session.
   */
  check(check: MicCheck): boolean {
    if (!this.granted || !MIC_PERMISSIONS.has(check.permission)) return false;
    if (check.mediaType !== undefined && check.mediaType !== 'audio') return false;
    return originOf(check.requestingOrigin) === this.appOrigin;
  }
}
