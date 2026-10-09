/**
 * The C-CAM lettering specimen (PLAN.md#14.7): the SVG character sheet is deterministic and equals
 * the committed `support/c-cam-lettering-specimen.svg` (UPDATE_SPECIMEN=1 rewrites it).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLetteringSpecimenSvg } from './support/c-cam-lettering-specimen.js';

const SPECIMEN = fileURLToPath(new URL('./support/c-cam-lettering-specimen.svg', import.meta.url));

describe('C-CAM lettering specimen', () => {
  it('is deterministic', () => {
    expect(buildLetteringSpecimenSvg()).toBe(buildLetteringSpecimenSvg());
  });

  it('matches the committed sheet', async () => {
    const svg = buildLetteringSpecimenSvg();
    if (process.env['UPDATE_SPECIMEN'] === '1') await writeFile(SPECIMEN, svg);
    const committed = (await readFile(SPECIMEN, 'utf8')).replaceAll('\r\n', '\n');
    expect(svg).toBe(committed);
  });
});
