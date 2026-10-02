import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKit } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import { LIGHT_RIGS } from './lights.js';

const STYLES_DIR = path.resolve(import.meta.dirname, '..', '..', '..', '..', 'styles');

function lightsOf(object: THREE.Object3D): THREE.Light[] {
  return object.children.filter((child): child is THREE.Light => child instanceof THREE.Light);
}

describe('kit.env.lights rigs', () => {
  it('builds the low-key noir rig: weak fill, hard key from the upper left, accent rim', () => {
    const { env } = createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(1) }).api;
    const [hemisphere, key, rim] = lightsOf(env.lights({ preset: 'noir' }));
    expect(hemisphere?.type).toBe('HemisphereLight');
    expect(hemisphere?.intensity).toBeLessThan(1);
    expect(key?.name).toBe('keyLight');
    expect(key?.intensity).toBeGreaterThan(3);
    expect(key?.position.x).toBeLessThan(0);
    expect(key?.position.y).toBeGreaterThan(0);
    expect(rim?.name).toBe('rimLight');
    expect(`#${rim?.color.getHexString() ?? ''}`).toBe(CRISP_PALETTE['accent1']);
    expect(rim?.position.z).toBeLessThan(0);
  });

  it('has the rig every styles/<id>/style.json recommends', () => {
    const folders = readdirSync(STYLES_DIR, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory(),
    );
    expect(folders.length).toBeGreaterThanOrEqual(3);
    for (const folder of folders) {
      const raw: unknown = JSON.parse(
        readFileSync(path.join(STYLES_DIR, folder.name, 'style.json'), 'utf8'),
      );
      const lights = typeof raw === 'object' && raw !== null && 'lights' in raw ? raw.lights : null;
      expect(Object.keys(LIGHT_RIGS), folder.name).toContain(lights);
    }
  });
});
