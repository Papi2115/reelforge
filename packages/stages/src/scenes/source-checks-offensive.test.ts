import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { offensiveSourceFindings } from './source-checks-offensive.js';

const examples = fileURLToPath(new URL('../../../kit/examples', import.meta.url));

function sceneFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) return sceneFiles(full);
    return name.endsWith('.js') ? [full] : [];
  });
}

const comicScene = (word: string): string => `export const meta = { id: 's02', title: 'pit' };
export function build(ctx) {
  const page = ctx.kit.fx.comicPage({ look: 'comic-story' });
  page.sfx(${JSON.stringify(word)}, { x: 300, y: 96, at: 1.2, size: 9 });
  return { page };
}
export function update(t, state) { state.page.update(t); }`;

describe('offensiveSourceFindings', () => {
  it('reports the real-run slur as an error with its replacements', () => {
    const findings = offensiveSourceFindings(comicScene('CHINK'), 'scenes/s02_gravel_pit.js');
    expect(findings).toEqual([
      {
        source: 'scene',
        severity: 'error',
        fatal: false,
        message:
          'scenes/s02_gravel_pit.js:4: offensive or slur-like word "CHINK" — use another word (e.g. CLINK, CLANG, TINK)',
      },
    ]);
  });

  it('reads strings of every kind: helpers, constants, templates, built-in text', () => {
    const source = `const WORD = 'sh1t';
export function build(ctx) { const say = (w) => w; say('C H I N K'); return {}; }
export function update(t, s, ctx) { ctx.text.title(\`what the f*ck \${t}\`); }`;
    const messages = offensiveSourceFindings(source, 'scenes/a.js').map((f) => f.message);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toContain('scenes/a.js:1: offensive or slur-like word "sh1t"');
    expect(messages[1]).toContain('"C H I N K"');
    expect(messages[2]).toContain('"f*ck"');
  });

  it('passes harmless sound words and words that only contain a term', () => {
    for (const word of ['CLINK', 'CLANG', 'TINK', 'CHINKING', 'Chinkapin', 'THINK', 'INK']) {
      expect(offensiveSourceFindings(comicScene(word), 'scenes/s02.js')).toEqual([]);
    }
  });

  it('ignores comments and unparseable sources', () => {
    expect(offensiveSourceFindings('// never write CHINK here\nconst a = 1;', 's.js')).toEqual([]);
    expect(offensiveSourceFindings("page.sfx('CHINK'", 's.js')).toEqual([]);
  });

  it('has no false positives on the example scenes of every world and style', () => {
    const files = sceneFiles(examples);
    expect(files.length).toBeGreaterThan(20);
    const flagged = files.flatMap((file) =>
      offensiveSourceFindings(readFileSync(file, 'utf8'), file).map((entry) => entry.message),
    );
    expect(flagged).toEqual([]);
  });
});
