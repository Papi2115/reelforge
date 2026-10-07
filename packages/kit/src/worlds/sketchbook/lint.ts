/**
 * A source check for Sketchbook scenes: letters drawn as home-made strokes (a scene-local glyph
 * table, or a loop over a string's characters that strokes each one) instead of `page.write`.
 * Such text dodges the hand's lettering (and the text-provenance guard, which reads
 * `page.write` strings) and was the workaround for slow writing (docs/real-run-sketchbook-2.md,
 * s09). Pure string analysis: the stages guards can run it on a scene before rendering.
 */

export interface StrokeLetteringFinding {
  /** 1-based line of the source. */
  readonly line: number;
  readonly rule: 'glyph-table' | 'char-strokes';
  readonly message: string;
}

const FIX =
  'use page.write (it is fast: speed up to 2, quick: true for labels, appear for secondary text); never draw letters as page.stroke';

/** A key that names one capital or digit (`A:`, `"/":`, `'7':`) mapped to a stroke list `[[`. */
const GLYPH_KEY = /(?:^|[{,\s])(?:[A-Z0-9]|"[^"\s]"|'[^'\s]')\s*:\s*\[\s*\[/g;
/** A loop over the characters of a string. */
const CHAR_LOOP = /for\s*\(\s*(?:const|let)\s+(\w+)\s+of\s+[\w.]+\s*\)/g;

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Glyph tables: three or more one-character keys mapped to stroke lists within 40 lines. */
function glyphTables(source: string): StrokeLetteringFinding[] {
  const lines = [...source.matchAll(GLYPH_KEY)].map((match) => lineOf(source, match.index));
  for (let i = 0; i + 2 < lines.length; i += 1) {
    const [first, third] = [lines[i] ?? 0, lines[i + 2] ?? 0];
    if (third - first <= 40) {
      const message = `line ${String(first)}: a table of letter strokes (home-made lettering): ${FIX}`;
      return [{ line: first, rule: 'glyph-table', message }];
    }
  }
  return [];
}

/** Loops over characters that look each one up (`table[ch]`) and call `.stroke(` nearby. */
function charStrokes(source: string): StrokeLetteringFinding[] {
  const out: StrokeLetteringFinding[] = [];
  for (const match of source.matchAll(CHAR_LOOP)) {
    const name = match[1] ?? '';
    const body = source.slice(match.index, match.index + 600);
    if (body.includes(`[${name}]`) && body.includes('.stroke(')) {
      const line = lineOf(source, match.index);
      out.push({
        line,
        rule: 'char-strokes',
        message: `line ${String(line)}: text drawn character by character with page.stroke: ${FIX}`,
      });
    }
  }
  return out;
}

/** Every place the scene letters text with its own strokes instead of `page.write`. */
export function strokeLetteringFindings(source: string): StrokeLetteringFinding[] {
  return [...glyphTables(source), ...charStrokes(source)].sort((a, b) => a.line - b.line);
}
