/**
 * Escaping for values placed inside an ffmpeg filtergraph string (e.g. `arnndn=m=<path>`).
 * Two levels apply (ffmpeg-filters "Notes on filtergraph escaping"):
 *   1. option value: `\`, `'` and `:` are escaped with `\`;
 *   2. graph description: `\`, `'`, `[`, `]`, `,` and `;` are escaped with `\`.
 * Windows paths use forward slashes, so `C:\a b\x.rnnn` becomes `C\\:/a b/x.rnnn`.
 * Arguments are passed to ffmpeg as an argv array (no shell), so no shell quoting is involved.
 */

export function escapeFilterOptionValue(value: string): string {
  return value.replace(/[\\':]/g, (char) => `\\${char}`);
}

export function escapeFiltergraphText(text: string): string {
  return text.replace(/[\\'[\],;]/g, (char) => `\\${char}`);
}

/** Converts a file path into a filtergraph-safe option value (both escaping levels). */
export function filterPathValue(filePath: string): string {
  const forward = filePath.replace(/\\/g, '/');
  return escapeFiltergraphText(escapeFilterOptionValue(forward));
}
