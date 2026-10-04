import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyClaimEdit, claimsFileSchema, formatClaimsReport } from '@reelforge/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EXAMPLE_DIR } from '../testing/example-film.js';
import { FakeClaudeHarness, writes } from '../testing/fake-claude.js';
import { checkSources, readClaimsFile, writeClaimsFile } from './check-sources.js';
import { sourceChipLines, storyboardSourceChipVars } from './source-chips.js';

/** research.md of the example project (doom-on-a-calculator has none; the fixture stands in). */
const RESEARCH = [
  '## Key facts',
  '- Doom has been ported to fridges, watches and printers — https://en.wikipedia.org/wiki/List_of_Doom_ports',
  '- Doom (1993) required 4 MB of RAM — https://doomwiki.org/wiki/Doom',
  '- The TI-84 Plus CE port fits in about 61 KB of free RAM ([Cemetech](https://www.cemetech.net/forum/viewtopic.php?t=doom84))',
  '## Timeline',
  '- 1993: Doom released — https://doomwiki.org/wiki/Doom',
  '## People & entities',
  '- id Software — https://en.wikipedia.org/wiki/Id_Software',
  '## Numbers worth showing on screen',
  '- 61 KB — https://www.cemetech.net/forum/viewtopic.php?t=doom84',
  '## Open questions / uncertain',
  '- who ported it first',
].join('\n');

/** Claude's canned reply: 3 sourced, one with an invented id, one unsourced, one misquoted. */
const REPLY = JSON.stringify({
  claims: [
    {
      sentence: 2,
      text: 'Fridges, watches, even a printer',
      kind: 'name',
      sources: ['r1'],
      status: 'sourced',
    },
    {
      sentence: 3,
      text: 'only 61 KB of memory',
      kind: 'number',
      sources: ['r3'],
      status: 'sourced',
    },
    {
      sentence: 4,
      text: 'The original game needed four megabytes',
      kind: 'number',
      sources: ['r2'],
      status: 'sourced',
    },
    {
      sentence: 6,
      text: 'hackers rewrote the engine, shrank the maps',
      kind: 'causal',
      sources: ['r9'],
      status: 'sourced',
    },
    {
      sentence: 8,
      text: 'If it has a screen, it runs Doom',
      kind: 'causal',
      sources: [],
      status: 'unsourced',
    },
    { sentence: 5, text: 'not in this sentence', kind: 'number', sources: [], status: 'unsourced' },
  ],
});

const NOW = new Date('2026-10-04T10:00:00.000Z');
let dir: string;
let harness: FakeClaudeHarness | undefined;

beforeEach(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'rf claims żółw '));
  copyFileSync(path.join(EXAMPLE_DIR, 'script.txt'), path.join(dir, 'script.txt'));
  writeFileSync(path.join(dir, 'research.md'), RESEARCH);
});

afterEach(async () => {
  await harness?.dispose();
  harness = undefined;
  rmSync(dir, { recursive: true, force: true });
});

function run(reply: string): ReturnType<typeof checkSources> {
  harness = new FakeClaudeHarness([writes({}, reply)]);
  return checkSources({ projectDir: dir, claude: harness.runner, model: 'sonnet', now: () => NOW });
}

describe('checkSources on the example project (fake-claude)', () => {
  it('writes claims.json and reports sourced vs unsourced claims', async () => {
    const result = await run(REPLY);
    if (!result.ok) throw new Error(result.error);
    const { file, report, warnings } = result.value;
    expect(report.counts).toEqual({ sourced: 3, unsourced: 2, disputed: 0, 'user-confirmed': 0 });
    expect(formatClaimsReport(file)).toBe(
      [
        '5 claims: 3 sourced, 2 without a source, 0 disputed, 0 confirmed by you',
        'Without a source:',
        '- c4 (causal): "hackers rewrote the engine, shrank the maps"',
        '- c5 (causal): "If it has a screen, it runs Doom"',
        '',
      ].join('\n'),
    );
    expect(warnings).toHaveLength(2);
    expect(file).toMatchObject({
      checkedAt: NOW.toISOString(),
      scriptFingerprint: expect.stringMatching(/^[0-9a-f]{8}$/) as string,
    });
    expect(file.claims[1]).toMatchObject({
      id: 'c2',
      sentence: 2,
      words: [23, 27],
      sourceIds: ['r3'],
    });
    expect(file.sources.map((source) => [source.id, source.name])).toEqual([
      ['r1', 'en.wikipedia.org'],
      ['r2', 'doomwiki.org'],
      ['r3', 'Cemetech'],
      ['r4', 'en.wikipedia.org'],
    ]);
    const saved = claimsFileSchema.parse(
      JSON.parse(readFileSync(path.join(dir, 'claims.json'), 'utf8')),
    );
    expect(saved).toEqual(file);
    const spec = harness?.specs[0];
    expect(spec).toMatchObject({
      stage: 'critic',
      purpose: 'qa',
      model: 'sonnet',
      newSession: true,
    });
    expect(spec?.prompt).toContain('3. But this one is special');
    expect(spec?.prompt).toContain('r3 · Cemetech · The TI-84 Plus CE port fits in about 61 KB');
    expect(sourceChipLines(file)).toEqual([
      '- "Fridges, watches, even a printer" → en.wikipedia.org',
      '- "only 61 KB of memory" → Cemetech',
      '- "The original game needed four megabytes" → doomwiki.org',
    ]);
  });

  it('keeps the user’s sources and decisions on a new check', async () => {
    const first = await run(REPLY);
    if (!first.ok) throw new Error(first.error);
    await harness?.dispose();
    const attached = applyClaimEdit(first.value.file, {
      op: 'attach',
      claimId: 'c5',
      source: { kind: 'url', url: 'https://www.reddit.com/r/itrunsdoom/', name: 'r/itrunsdoom' },
    });
    if (!attached.ok) throw new Error(attached.message);
    await writeClaimsFile(dir, attached.file);
    const second = await run(REPLY);
    if (!second.ok) throw new Error(second.error);
    expect(second.value.file.claims[4]).toMatchObject({ sourceIds: ['u1'], status: 'sourced' });
    expect(second.value.report.counts.sourced).toBe(4);
    expect(await readClaimsFile(dir)).toEqual(second.value.file);
  });

  it('fails clearly without a script or with an unusable reply', async () => {
    const invalid = await run('Sure! Here are the claims.');
    expect(invalid).toMatchObject({
      ok: false,
      error: expect.stringMatching(/^Claude's reply was not usable/) as string,
    });
    expect(existsSync(path.join(dir, 'claims.json'))).toBe(false);
    await harness?.dispose();
    rmSync(path.join(dir, 'script.txt'));
    expect(await run(REPLY)).toEqual({
      ok: false,
      error: 'There is no script yet: write the script first.',
    });
  });
});

describe('storyboard source-chip vars', () => {
  it('are empty without claims.json and list the chip names with one', async () => {
    expect(await storyboardSourceChipVars(dir)).toEqual({});
    const result = await run(REPLY);
    if (!result.ok) throw new Error(result.error);
    expect(await storyboardSourceChipVars(dir)).toEqual({
      sourceChips: sourceChipLines(result.value.file).join('\n'),
    });
  });
});
