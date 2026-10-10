/**
 * Grim Ink (c-cam) kit-docs (PLAN.md#14.10): one short topic per part of the drawing API, every
 * text under the Bash output limit, names from the prompts' one API list and the kit's own word
 * lists, and the world's kit-docs index (once it is wired, PLAN.md#14.12) under 28 KB.
 */
import { C_CAM_VOCABULARY, kitCatalog, LOOKS } from '@reelforge/kit';
import { C_CAM_API, C_CAM_MODULE_TOPICS, C_CAM_SNIPPETS, C_CAM_TOPICS } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';
import { C_CAM_TOPIC_NAMES, describeCCamTopic } from './kit-docs-c-cam.js';
import { formatCatalog } from './kit-docs-index.js';
import { describeKitName } from './kit-docs.js';

const LIMIT = 28_000;
const CATALOG = kitCatalog();

function topic(name: string): string {
  const text = describeCCamTopic(name);
  if (text === undefined) throw new Error(`no topic ${name}`);
  return text;
}

describe('kit-docs Grim Ink topics', () => {
  it('has one short topic per part of the API, each reachable through kit-docs', () => {
    expect(C_CAM_TOPIC_NAMES).toEqual([
      'grim-ink',
      'ink-stage',
      'ink-brushes',
      'ink-faces',
      'ink-rig',
      'ink-camera',
      'ink-lettering',
    ]);
    for (const name of C_CAM_TOPIC_NAMES) {
      const text = topic(name);
      expect(text.length, name).toBeLessThan(6_000);
      expect(describeKitName(CATALOG, name)).toBe(text);
      expect(text.split('\n').at(-1)).toBe(
        `topics: ${C_CAM_TOPIC_NAMES.join(', ')}; modules: people, places (reelforge kit-docs <topic>)`,
      );
    }
    const all = C_CAM_TOPIC_NAMES.map(topic).join('\n');
    expect(all.length).toBeLessThan(LIMIT);
    expect(describeCCamTopic('ink-scene')).toBeUndefined();
    expect(() => describeKitName(CATALOG, 'ink-camra')).toThrow(/did you mean: ink-camera/);
  });

  it("lists the kit's own word lists, so the docs follow the kit", () => {
    for (const name of C_CAM_VOCABULARY.expressions) expect(topic('ink-faces')).toContain(name);
    for (const name of C_CAM_VOCABULARY.poses) expect(topic('ink-rig')).toContain(name);
    for (const name of C_CAM_VOCABULARY.views) expect(topic('ink-rig')).toContain(name);
    for (const name of C_CAM_VOCABULARY.cutEases) expect(topic('ink-camera')).toContain(name);
    for (const name of C_CAM_VOCABULARY.letterFaces) {
      expect(topic('ink-lettering')).toContain(name);
    }
    expect(topic('ink-stage')).toContain('INK, EYE, MOUTH');
    expect(topic('ink-camera')).toContain('z = zoom 0.8-5.4');
    expect(topic('ink-camera')).toContain('at most +-7');
  });

  it("names the API from the prompts' one list", () => {
    expect(topic('grim-ink')).toContain(
      'const stage = ctx.kit.fx.inkStage(); ctx.scene.add(stage)',
    );
    expect(topic('ink-stage')).toContain(`${C_CAM_API.ink} — the world's draw functions`);
    expect(topic('grim-ink')).toContain(`${C_CAM_API.peopleDir}/<id>.js`);
    expect(topic('grim-ink')).toContain(`${C_CAM_API.placesDir}/<id>.js`);
    expect(topic('grim-ink')).toContain(C_CAM_SNIPPETS.person);
    expect(topic('ink-lettering')).toContain('never ctx.text');
    // The real stage API today: the fx's own method docs name the zoom-1 brushes the topics use.
    const stage = kitCatalog([], LOOKS, { style: 'c-cam', experimental: true }).fx.find(
      (entry) => entry.name === 'inkStage',
    );
    const methods = JSON.stringify(stage?.methods ?? {});
    for (const name of ['inkLine(pts, o)', 'blob(pts, fill, o)', 'twos', 'hash']) {
      expect(methods).toContain(name);
    }
  });

  it('every kit-docs topic the look docs point at exists', () => {
    const looks = LOOKS.filter((look) => look.styles?.includes('c-cam'));
    expect(looks.map((look) => look.id)).toEqual(['ink-scene', 'ink-insert', 'ink-poster']);
    const named = looks.flatMap((look) =>
      [...look.docs.matchAll(/reelforge kit-docs ([a-z-]+)/g)].map((match) => match[1] ?? ''),
    );
    expect(named.length).toBeGreaterThan(5);
    const known: readonly string[] = [
      ...Object.values(C_CAM_TOPICS),
      ...Object.values(C_CAM_MODULE_TOPICS),
    ];
    for (const name of named) expect(known).toContain(name);
  });

  it('keeps the world index (looks on) under 28 KB', () => {
    const catalog = kitCatalog([], LOOKS, { style: 'c-cam', experimental: true });
    expect(catalog.looks.map((look) => look.id)).toEqual(['ink-scene', 'ink-insert', 'ink-poster']);
    const index = formatCatalog(catalog, { lookMode: 'mixed' });
    expect(index).toContain('inkStage');
    expect(index).not.toContain('kit.voxel:');
    expect(Buffer.byteLength(index, 'utf8')).toBeLessThan(28 * 1024);
    expect(index.length).toBeLessThan(LIMIT);
    for (const look of catalog.looks) {
      expect(describeKitName(catalog, look.id, { lookMode: 'mixed' }).length).toBeLessThan(LIMIT);
    }
  });
});
