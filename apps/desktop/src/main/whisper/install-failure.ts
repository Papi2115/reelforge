/**
 * Turns a whisper install failure into what the user should do about it: offline, server error,
 * disk full, blocked by antivirus / Windows, broken download. The technical error stays available
 * as `detail` ("Show details").
 */
import type { WhisperError } from '@reelforge/pipeline';

export interface InstallFailure {
  readonly message: string;
  readonly detail: string;
}

/** Connection-level errors (DNS, refused, reset, timeouts, TLS) of Node / undici. */
const OFFLINE_CODES = new Set([
  'ENOTFOUND',
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENETDOWN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_SOCKET',
  'CERT_HAS_EXPIRED',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
]);
/** The file system refused: typically antivirus software holding or quarantining the exe. */
const BLOCKED_CODES = new Set(['EPERM', 'EACCES', 'EBUSY', 'CLI_MISSING']);

function codeOf(error: WhisperError): string | undefined {
  return error.kind === 'download-failed' || error.kind === 'extract-failed' || error.kind === 'io'
    ? error.code
    : undefined;
}

export function installFailure(error: WhisperError, root: string): InstallFailure {
  const detail = error.message;
  const code = codeOf(error);
  if (error.kind === 'cancelled') return { message: 'Download cancelled.', detail };
  if (code === 'ENOSPC') {
    return {
      message: `Not enough free disk space for whisper.cpp in ${root}. Free up some space and try again.`,
      detail,
    };
  }
  if (code !== undefined && BLOCKED_CODES.has(code)) {
    return {
      message:
        'Windows or your antivirus software blocked whisper.cpp. Allow whisper-cli.exe in the antivirus (or add an exclusion for the folder below), then try again — or choose a whisper-cli you already have with Browse….',
      detail: `${detail} (${root})`,
    };
  }
  if (error.kind === 'checksum-mismatch') {
    return {
      message:
        'The download did not match its published checksum and was deleted (a broken download, or a proxy changing it). Try again.',
      detail,
    };
  }
  if (error.kind === 'download-failed') {
    if (error.status !== null) {
      return {
        message: `The download server answered HTTP ${String(error.status)}. Try again later.`,
        detail,
      };
    }
    if (code === undefined || OFFLINE_CODES.has(code)) {
      return {
        message:
          'Could not reach the download server (GitHub / Hugging Face). Check the internet connection, proxy or firewall, then try again.',
        detail,
      };
    }
  }
  if (error.kind === 'extract-failed') {
    return {
      message: 'The downloaded whisper.cpp archive could not be unpacked. Try again.',
      detail,
    };
  }
  return { message: `Installing whisper.cpp failed: ${error.message}`, detail };
}
