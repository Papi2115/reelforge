/**
 * The only network client of `reelforge` (ADR-012). Every request: https only, no credentials in
 * URLs, default port, ban list, the caller's policy check (research mode + allowed hosts), DNS
 * resolution checked against private/loopback/link-local/metadata ranges (the checked address is
 * the one connected to), manual redirects re-checked hop by hop, identity encoding, idle and total
 * timeouts, and a byte cap enforced while streaming. Plain node:http(s), no shell, no cookies.
 */
import { createHash } from 'node:crypto';
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { createWriteStream } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import http from 'node:http';
import https from 'node:https';
import { isIP, type LookupFunction } from 'node:net';
import { pipeline } from 'node:stream/promises';
import { Transform, type TransformCallback } from 'node:stream';
import { ASSET_LIMITS } from './limits.js';
import { bannedReason, blockedAddressReason, isLoopbackLiteral, normalizeHost } from './hosts.js';

/** A request the policy refuses (mode, host, ban list, SSRF): nothing was downloaded. */
export class FetchRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchRefused';
  }
}

/** The request was allowed but failed (status, size cap, timeout, network). */
export class FetchFailed extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchFailed';
  }
}

/** Resolves a host name to addresses (injectable so tests can simulate DNS answers). */
export type Resolver = (host: string) => Promise<readonly LookupAddress[]>;

export interface TransportOptions {
  /**
   * TESTS ONLY: allow plain http and any port to the literal 127.0.0.1 / ::1. Never set from
   * project settings or command-line flags.
   */
  readonly allowLoopbackHttpForTests?: boolean | undefined;
  readonly resolver?: Resolver | undefined;
  readonly userAgent?: string | undefined;
  readonly idleTimeoutMs?: number | undefined;
}

/** Policy of the caller: why `url` may not be requested at redirect hop `hop`, or undefined. */
export type UrlPolicy = (url: URL, hop: number) => string | undefined;

export const DEFAULT_USER_AGENT =
  'ReelForge/2.1 (local desktop video tool; asset research of open-licence media)';

const systemResolver: Resolver = (host) =>
  new Promise((resolve, reject) => {
    dnsLookup(host, { all: true, verbatim: true }, (error, addresses) => {
      if (error) reject(error);
      else resolve(addresses);
    });
  });

function loopbackAllowed(options: TransportOptions, host: string): boolean {
  return options.allowLoopbackHttpForTests === true && isLoopbackLiteral(host);
}

/** Transport-level refusal reason (independent of the research mode). */
export function transportRefusal(url: URL, options: TransportOptions): string | undefined {
  const host = normalizeHost(url.hostname);
  const testLoopback = loopbackAllowed(options, host);
  if (url.protocol !== 'https:' && !(testLoopback && url.protocol === 'http:')) {
    return `only https URLs are fetched (got ${url.protocol}//${host})`;
  }
  if (url.username !== '' || url.password !== '') return 'URLs with credentials are refused';
  if (url.port !== '' && url.port !== '443' && !testLoopback) {
    return `non-standard port ${url.port} is refused`;
  }
  const banned = bannedReason(url);
  if (banned !== undefined) return banned;
  if (isIP(host) !== 0 && !testLoopback) {
    const blocked = blockedAddressReason(host);
    if (blocked !== undefined) return `${host}: ${blocked} (SSRF protection)`;
  }
  return undefined;
}

function guardedLookup(options: TransportOptions): LookupFunction {
  const resolver = options.resolver ?? systemResolver;
  return (hostname, lookupOptions, callback) => {
    resolver(hostname).then(
      (addresses) => {
        const blocked = addresses
          .map((entry) => ({ entry, reason: blockedAddressReason(entry.address) }))
          .find(
            ({ entry, reason }) => reason !== undefined && !loopbackAllowed(options, entry.address),
          );
        if (addresses.length === 0 || blocked !== undefined) {
          const reason =
            blocked === undefined
              ? 'no address'
              : `${blocked.entry.address}: ${blocked.reason ?? ''}`;
          callback(new FetchRefused(`${hostname} resolves to ${reason} (SSRF protection)`), '', 4);
          return;
        }
        const [primary] = addresses;
        if (lookupOptions.all === true) callback(null, [...addresses]);
        else if (primary !== undefined) callback(null, primary.address, primary.family);
      },
      (error: unknown) => {
        callback(error instanceof Error ? error : new Error(String(error)), '', 4);
      },
    );
  };
}

interface OpenedResponse {
  readonly response: IncomingMessage;
  readonly finalUrl: URL;
}

function requestOnce(
  url: URL,
  options: TransportOptions,
  signal: AbortSignal,
  accept: string,
): Promise<IncomingMessage> {
  const client = url.protocol === 'http:' ? http : https;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      {
        method: 'GET',
        agent: false,
        signal,
        lookup: guardedLookup(options),
        headers: {
          'user-agent': options.userAgent ?? DEFAULT_USER_AGENT,
          'accept-encoding': 'identity',
          accept,
        },
      },
      resolve,
    );
    request.setTimeout(options.idleTimeoutMs ?? ASSET_LIMITS.idleTimeoutMs, () => {
      request.destroy(new FetchFailed(`no response from ${url.host} in time`));
    });
    request.on('error', reject);
    request.end();
  });
}

async function openResponse(
  start: string,
  policy: UrlPolicy,
  options: TransportOptions,
  signal: AbortSignal,
  accept: string,
): Promise<OpenedResponse> {
  let current: URL;
  try {
    current = new URL(start);
  } catch {
    throw new FetchRefused(`not a valid URL: ${start.slice(0, 200)}`);
  }
  for (let hop = 0; hop <= ASSET_LIMITS.maxRedirects; hop += 1) {
    const refusal = transportRefusal(current, options) ?? policy(current, hop);
    if (refusal !== undefined) {
      throw new FetchRefused(hop === 0 ? refusal : `redirect refused: ${refusal}`);
    }
    const response = await requestOnce(current, options, signal, accept);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;
    if (status >= 300 && status < 400 && location !== undefined) {
      response.resume();
      current = new URL(location, current);
      continue;
    }
    if (status !== 200) {
      response.resume();
      throw new FetchFailed(`${current.host} answered HTTP ${String(status)}`);
    }
    const encoding = response.headers['content-encoding'];
    if (encoding !== undefined && encoding !== 'identity') {
      response.resume();
      throw new FetchFailed(
        `${current.host} sent a ${encoding}-encoded body (only identity accepted)`,
      );
    }
    return { response, finalUrl: current };
  }
  throw new FetchRefused(`more than ${String(ASSET_LIMITS.maxRedirects)} redirects`);
}

function declaredTooLarge(response: IncomingMessage, maxBytes: number): boolean {
  const declared = Number(response.headers['content-length']);
  return Number.isFinite(declared) && declared > maxBytes;
}

/** Counts bytes and hashes them; errors once the cap is passed (aborting the stream). */
class CappedHash extends Transform {
  readonly hash = createHash('sha256');
  bytes = 0;
  constructor(private readonly maxBytes: number) {
    super();
  }
  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.bytes += chunk.length;
    if (this.bytes > this.maxBytes) {
      callback(
        new FetchFailed(`larger than the ${String(this.maxBytes)}-byte cap; download stopped`),
      );
      return;
    }
    this.hash.update(chunk);
    callback(null, chunk);
  }
}

function withDeadline<T>(deadlineMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new FetchFailed(`took longer than ${String(deadlineMs / 1000)} s`));
  }, deadlineMs);
  return run(controller.signal)
    .catch((error: unknown) => {
      if (controller.signal.aborted && controller.signal.reason instanceof FetchFailed) {
        throw controller.signal.reason;
      }
      throw error;
    })
    .finally(() => {
      clearTimeout(timer);
    });
}

/** GET a JSON document through the guards. */
export function getJson(
  url: string,
  policy: UrlPolicy,
  options: TransportOptions,
  maxBytes: number = ASSET_LIMITS.jsonBytes,
): Promise<unknown> {
  return withDeadline(ASSET_LIMITS.apiDeadlineMs, async (signal) => {
    const { response, finalUrl } = await openResponse(
      url,
      policy,
      options,
      signal,
      'application/json',
    );
    if (declaredTooLarge(response, maxBytes)) {
      response.destroy();
      throw new FetchFailed(`${finalUrl.host}: response larger than ${String(maxBytes)} bytes`);
    }
    const chunks: Buffer[] = [];
    await pipeline(response, new CappedHash(maxBytes), async (source: AsyncIterable<Buffer>) => {
      for await (const chunk of source) chunks.push(chunk);
    });
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      throw new FetchFailed(`${finalUrl.host} did not answer with JSON`);
    }
  });
}

export interface DownloadResult {
  readonly bytes: number;
  readonly sha256: string;
  readonly finalUrl: string;
}

/**
 * Streams `url` into `target` (a new file). On any failure the caller deletes `target`; this
 * function never leaves an open handle behind.
 */
export function downloadToFile(
  url: string,
  policy: UrlPolicy,
  options: TransportOptions,
  target: string,
  maxBytes: number,
  deadlineMs: number,
): Promise<DownloadResult> {
  return withDeadline(deadlineMs, async (signal) => {
    const { response, finalUrl } = await openResponse(
      url,
      policy,
      options,
      signal,
      'image/*, video/*',
    );
    if (declaredTooLarge(response, maxBytes)) {
      response.destroy();
      throw new FetchFailed(`${finalUrl.host}: file larger than the ${String(maxBytes)}-byte cap`);
    }
    const counter = new CappedHash(maxBytes);
    await pipeline(response, counter, createWriteStream(target, { flags: 'wx' }), { signal });
    return {
      bytes: counter.bytes,
      sha256: counter.hash.digest('hex'),
      finalUrl: finalUrl.toString(),
    };
  });
}
