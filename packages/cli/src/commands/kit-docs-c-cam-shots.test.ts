/**
 * PLAN.md#14.19: the Grim Ink library topic and the technique shots of the concept films: short,
 * reachable through kit-docs, labelled "technique, not content", naming only real stage calls and
 * neutral ids (no concept-film object in the code).
 */
import { kitCatalog, STAGE_INK_NAMES } from '@reelforge/kit';
import { C_CAM_LIB_TOPIC, C_CAM_SHOT_TOPICS } from '@reelforge/prompts';
import { describe, expect, it } from 'vitest';
import { C_CAM_REFERENCE_TOPICS, describeCCamReferenceTopic } from './kit-docs-c-cam-shots.js';
import { describeKitName } from './kit-docs.js';

const CATALOG = kitCatalog();
const SHOWCASE =
  /samurai|katana|shogun|pope|papal|cardinal|conclave|apollo|lunar|lander|astronaut|toy ?bear/i;

function topic(name: string): string {
  const text = describeCCamReferenceTopic(name);
  if (text === undefined) throw new Error(`no topic ${name}`);
  return text;
}

describe('kit-docs Grim Ink library and technique shots (PLAN.md#14.19)', () => {
  it('has the library topic and the five technique shots, each under 6 KB and reachable', () => {
    expect(C_CAM_REFERENCE_TOPICS).toEqual([C_CAM_LIB_TOPIC, ...Object.values(C_CAM_SHOT_TOPICS)]);
    for (const name of C_CAM_REFERENCE_TOPICS) {
      const text = topic(name);
      expect(text.length, name).toBeLessThan(6_000);
      expect(describeKitName(CATALOG, name)).toBe(text);
    }
    expect(describeCCamReferenceTopic('ink-camera')).toBeUndefined();
  });

  it('labels every shot as technique, never content, and names only real stage calls', () => {
    for (const name of Object.values(C_CAM_SHOT_TOPICS)) {
      const text = topic(name);
      expect(text, name).toContain('TECHNIQUE, NOT CONTENT');
      const calls = [...text.matchAll(/env\.ink\.([A-Za-z]+)/g)].map((match) => match[1] ?? '');
      for (const call of calls) expect(STAGE_INK_NAMES, `${name}: ${call}`).toContain(call);
    }
  });

  it('keeps the concept films out of the code: only the description names them', () => {
    for (const name of Object.values(C_CAM_SHOT_TOPICS)) {
      const code = topic(name)
        .split('\n')
        .filter((line) => /ctx\.|env\.|s\.cuts|\{ at:/.test(line));
      for (const line of code) expect(line, name).not.toMatch(SHOWCASE);
    }
  });

  it('documents the library contract and both call sites', () => {
    const text = topic(C_CAM_LIB_TOPIC);
    expect(text).toContain('export const lib = {');
    expect(text).toContain('ctx.kit.lib.<name>.<fn>(g, cam.env, ...)');
    expect(text).toContain('ink.lib.<name>.<fn>(g, ink, ...)');
    expect(text).toMatch(/64 libraries, 160 KB and 450 lines/);
  });
});
