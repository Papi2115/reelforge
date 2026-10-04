import { describe, expect, it } from 'vitest';
import { CAST, CAST_SPECS, EXAMPLE_ROLES } from './cast-presets.js';
import { isCastColor, isSpecColor } from './palette.js';
import { ACCESSORY_ITEMS } from './role-accessories.js';
import { HELD_ITEMS } from './role-held.js';
import { HAIR_ITEMS, HEADGEAR_ITEMS } from './role-head.js';
import { LAYER_ITEMS } from './role-layers.js';
import { MAX_OUTFIT_COLORS, outfitColors, roleSpecSchema, validateRoleSpec } from './role-spec.js';

const MINIMAL = {
  id: 'barista',
  label: 'Barista',
  top: { color: 'cream' },
  legs: { color: 'darkSlate' },
  shoes: { color: 'black' },
};

describe('role specs', () => {
  it('expresses the ten cast members and the examples, each within four outfit colours', () => {
    for (const id of CAST) {
      const result = validateRoleSpec(CAST_SPECS[id]);
      expect(result, id).toMatchObject({ ok: true });
      if (result.ok)
        expect(outfitColors(result.spec).length, id).toBeLessThanOrEqual(MAX_OUTFIT_COLORS);
    }
    for (const spec of EXAMPLE_ROLES)
      expect(validateRoleSpec(spec), spec.id).toMatchObject({ ok: true });
  });

  it('fills defaults and accepts items as ids or { id, color, trim, detail }', () => {
    const spec = roleSpecSchema.parse({
      ...MINIMAL,
      layers: ['apron', { id: 'tie', color: 'pink' }],
      held: 'microphone',
    });
    expect(spec).toMatchObject({
      version: 1,
      body: 'standard',
      skin: 'peach',
      hair: { style: 'short' },
      headgear: { id: 'none' },
      eyes: { style: 'dots' },
      layers: [{ id: 'apron' }, { id: 'tie', color: 'pink' }],
      held: { id: 'microphone' },
    });
    expect(outfitColors(spec)).toEqual(['cream', 'darkSlate', 'slateGrey', 'pink']);
  });

  it('rejects a fifth outfit colour, unknown colours, items and fields with readable errors', () => {
    const tooMany = validateRoleSpec({
      ...MINIMAL,
      layers: [
        { id: 'labCoat', color: 'tan' },
        { id: 'tie', color: 'pink' },
      ],
      headgear: { id: 'cap', color: 'brightTeal' },
    });
    expect(tooMany).toMatchObject({ ok: false });
    if (!tooMany.ok) expect(tooMany.errors.join()).toMatch(/uses 5 colours .* at most 4/);
    const badColor = validateRoleSpec({ ...MINIMAL, top: { color: 'chartreuse' } });
    if (badColor.ok) throw new Error('expected an error');
    expect(badColor.errors[0]).toMatch(/^top\.color: use a pack swatch/);
    expect(validateRoleSpec({ ...MINIMAL, held: 'banana' })).toMatchObject({ ok: false });
    expect(validateRoleSpec({ ...MINIMAL, hat: 'cap' })).toMatchObject({ ok: false });
    expect(validateRoleSpec({ ...MINIMAL, id: 'Fire Fighter' })).toMatchObject({ ok: false });
  });

  it('accepts style tokens as colours (they recolour with the style)', () => {
    expect(validateRoleSpec({ ...MINIMAL, top: { color: 'accent1' } })).toMatchObject({ ok: true });
  });

  it('every vocabulary item has a description and draws only with pack colours', () => {
    const items = [
      ...HAIR_ITEMS,
      ...HEADGEAR_ITEMS,
      ...LAYER_ITEMS,
      ...ACCESSORY_ITEMS,
      ...HELD_ITEMS,
    ];
    for (const item of items) {
      expect(item.description.length, item.id).toBeGreaterThan(3);
      for (const color of Object.values(item.colors))
        expect(isCastColor(color), item.id).toBe(true);
    }
    expect(new Set(items.map((item) => item.id)).size).toBeGreaterThan(40);
    expect(isSpecColor('hero')).toBe(true);
  });
});
