/**
 * Host rules of the asset fetcher: the ban list that holds in every research mode (YouTube and
 * other video platforms, social networks behind logins, paid stock libraries, login hosts) and the
 * address classes an asset request may never reach (SSRF: loopback, private, link-local, cloud
 * metadata, multicast, reserved).
 */
import { isIP } from 'node:net';

/** Domains (and their subdomains) never contacted, in any mode. */
export const BANNED_DOMAINS: readonly string[] = [
  // Video platforms and stream hosts (no stream ripping of any kind)
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'youtubei.googleapis.com',
  'googlevideo.com',
  'ytimg.com',
  'vimeo.com',
  'vimeocdn.com',
  'dailymotion.com',
  'dmcdn.net',
  'twitch.tv',
  'ttvnw.net',
  'tiktok.com',
  'tiktokcdn.com',
  'netflix.com',
  'nflxvideo.net',
  'nflximg.net',
  'primevideo.com',
  'disneyplus.com',
  'hulu.com',
  'bilibili.com',
  'rumble.com',
  // Social networks (content behind accounts)
  'facebook.com',
  'fbcdn.net',
  'instagram.com',
  'cdninstagram.com',
  'twitter.com',
  'x.com',
  'twimg.com',
  'threads.net',
  'reddit.com',
  'redd.it',
  'patreon.com',
  'onlyfans.com',
  // Paid stock libraries (paywalled licences)
  'gettyimages.com',
  'istockphoto.com',
  'shutterstock.com',
  'stock.adobe.com',
  'alamy.com',
  'depositphotos.com',
  'dreamstime.com',
  '123rf.com',
  // Account / sign-in services
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
];

/** First DNS labels of sign-in hosts (`login.example.com`), banned everywhere. */
const LOGIN_LABELS = new Set(['login', 'signin', 'sign-in', 'auth', 'sso', 'accounts', 'account']);
/** URL path fragments of sign-in pages, paywalls and stream manifests. */
const BANNED_PATH =
  /\/(?:login|signin|sign-in|oauth2?|auth|sso|paywall|subscribe)(?:[/?.]|$)|\.(?:m3u8|mpd)(?:$|\?)/i;

/** Lower-case host without a trailing dot and without IPv6 brackets. */
export function normalizeHost(host: string): string {
  return host
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
}

/** True when `host` is `domain` or one of its subdomains. */
export function hostMatches(host: string, domain: string): boolean {
  const normalized = normalizeHost(host);
  return normalized === domain || normalized.endsWith(`.${domain}`);
}

/** Why the URL is banned in every mode, or undefined. */
export function bannedReason(url: URL): string | undefined {
  const host = normalizeHost(url.hostname);
  const domain = BANNED_DOMAINS.find((banned) => hostMatches(host, banned));
  if (domain !== undefined)
    return `${host} is on the ban list (${domain}: video platform, social network, paid stock or sign-in host)`;
  const first = host.split('.')[0] ?? '';
  if (LOGIN_LABELS.has(first)) return `${host} looks like a sign-in host`;
  if (BANNED_PATH.test(url.pathname)) {
    return `${url.pathname} looks like a sign-in page, paywall or stream manifest`;
  }
  return undefined;
}

function ipv4Octets(address: string): number[] | undefined {
  const parts = address.split('.');
  if (parts.length !== 4) return undefined;
  const octets = parts.map((part) => Number(part));
  return octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? octets
    : undefined;
}

function blockedIpv4(address: string): string | undefined {
  const octets = ipv4Octets(address);
  if (octets === undefined) return 'malformed IPv4 address';
  const [a = 0, b = 0, c = 0] = octets;
  if (a === 0) return '"this network" address';
  if (a === 10) return 'private address (10/8)';
  if (a === 127) return 'loopback address';
  if (a === 169 && b === 254) return 'link-local / cloud metadata address';
  if (a === 172 && b >= 16 && b <= 31) return 'private address (172.16/12)';
  if (a === 192 && b === 168) return 'private address (192.168/16)';
  if (a === 100 && b >= 64 && b <= 127) return 'carrier-grade NAT address';
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return 'reserved address';
  if (a === 198 && (b === 18 || b === 19)) return 'benchmarking address';
  if (a === 198 && b === 51 && c === 100) return 'documentation address';
  if (a === 203 && b === 0 && c === 113) return 'documentation address';
  if (a >= 224) return 'multicast or reserved address';
  return undefined;
}

function blockedIpv6(address: string): string | undefined {
  const lower = normalizeHost(address);
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1] !== undefined) return blockedIpv4(mapped[1]);
  if (lower === '::' || lower === '::1') return 'loopback or unspecified address';
  if (/^f[cd]/.test(lower)) return 'unique-local address (fc00::/7)';
  if (/^fe[89ab]/.test(lower)) return 'link-local address (fe80::/10)';
  if (lower.startsWith('ff')) return 'multicast address';
  if (lower.startsWith('2001:db8') || lower.startsWith('2001:0db8')) return 'documentation address';
  if (lower.startsWith('fd00:ec2')) return 'cloud metadata address';
  return undefined;
}

/** Why an IP address may not be contacted (SSRF), or undefined for public addresses. */
export function blockedAddressReason(address: string): string | undefined {
  const family = isIP(normalizeHost(address));
  if (family === 4) return blockedIpv4(address);
  if (family === 6) return blockedIpv6(address);
  return 'not an IP address';
}

/** True for `127.0.0.1` / `::1` (the only hosts the test transport option may open). */
export function isLoopbackLiteral(host: string): boolean {
  const normalized = normalizeHost(host);
  return normalized === '127.0.0.1' || normalized === '::1';
}
