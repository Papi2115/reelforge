/**
 * Licence normalisation. `verified` = the licence comes from the source's structured metadata AND
 * is one that allows commercial use and modification (scenes always pixelise/recolour an asset):
 * public domain, CC0, CC BY, CC BY-SA, Free Art License. NC/ND and unknown licences stay
 * unverified (the guard refuses them outside ask/full-auto).
 */
import type { AssetLicence } from '@reelforge/shared';
import { sanitizeText, sanitizeUrl, TEXT_LIMITS } from '../untrusted.js';

const OPEN_LICENCES: readonly RegExp[] = [
  /^cc0(?: 1\.0)?$/i,
  /^public domain(?: mark(?: 1\.0)?)?$/i,
  /^pd(?:m|-[a-z0-9-]+)?$/i,
  /^cc by(?:-sa)? \d\.\d(?: [a-z]{2,3})?$/i,
  /^fal$/i,
  /^free art licen[cs]e$/i,
  /^nasa media usage guidelines$/i,
  /^no known restrictions on publication$/i,
];
const RESTRICTED = /\b(?:nc|nd|non-?commercial|no-?deriv)/i;

export function isOpenLicence(id: string): boolean {
  if (RESTRICTED.test(id)) return false;
  return OPEN_LICENCES.some((pattern) => pattern.test(id.trim()));
}

/** A licence named by a source's metadata. */
export function licenceFrom(name: unknown, url: unknown): AssetLicence {
  const id = sanitizeText(name, TEXT_LIMITS.licence);
  if (id === '') return unverifiedLicence(url);
  return { id, url: sanitizeUrl(url), verified: isOpenLicence(id) };
}

export function unverifiedLicence(url: unknown = null): AssetLicence {
  return { id: 'unverified', url: sanitizeUrl(url), verified: false };
}

/** Openverse/Creative Commons codes (`by-sa` + `4.0`, `cc0` + `1.0`, `pdm`) to a licence. */
export function creativeCommonsLicence(
  code: unknown,
  version: unknown,
  url: unknown,
): AssetLicence {
  if (typeof code !== 'string') return unverifiedLicence(url);
  const lower = code.toLowerCase();
  const versionText = typeof version === 'string' ? version : '';
  if (lower === 'cc0') return licenceFrom(`CC0 ${versionText || '1.0'}`, url);
  if (lower === 'pdm') return licenceFrom('Public domain mark 1.0', url);
  return licenceFrom(`CC ${lower.toUpperCase()} ${versionText}`.trim(), url);
}

/** Creative Commons public-domain tool URLs (Internet Archive `licenseurl`). */
export function publicDomainLicenceFromUrl(url: unknown): AssetLicence {
  const text = typeof url === 'string' ? url : '';
  if (/creativecommons\.org\/publicdomain\/zero\/1\.0/i.test(text)) {
    return licenceFrom('CC0 1.0', text);
  }
  if (/creativecommons\.org\/publicdomain\/mark\/1\.0/i.test(text)) {
    return licenceFrom('Public domain mark 1.0', text);
  }
  const cc = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i.exec(text);
  if (cc?.[1] !== undefined && cc[2] !== undefined) {
    return creativeCommonsLicence(cc[1], cc[2], text);
  }
  return unverifiedLicence(url);
}
