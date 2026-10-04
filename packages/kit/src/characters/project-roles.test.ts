import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { createKit } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';
import {
  accessoryExtensionSchema,
  floatingBoxes,
  MAX_ACCESSORY_BOXES,
  type AccessoryExtensionInput,
} from './accessory-extension.js';
import { CAST, EXAMPLE_ROLES } from './cast-presets.js';
import type { CharacterObject } from './character.js';
import { castListing, charactersDocs } from './docs.js';
import {
  checkProjectCast,
  loadProjectCast,
  parseRoleFile,
  type CastFileSource,
  type ProjectCast,
} from './project-roles.js';
import { closestId } from './suggest.js';

const [FIREFIGHTER, CHEF] = EXAMPLE_ROLES;

function roleFile(spec: object, id = (spec as { id: string }).id): CastFileSource {
  return { id, file: `characters/roles/${id}.json`, source: JSON.stringify(spec, null, 2) };
}

function accessoryFile(accessory: AccessoryExtensionInput): CastFileSource {
  return {
    id: accessory.id,
    file: `characters/accessories/${accessory.id}.json`,
    source: JSON.stringify(accessory),
  };
}

/** A police radio on the chest strap and a light bar on a cap (project accessories). */
const RADIO: AccessoryExtensionInput = {
  id: 'shoulderRadio',
  description: 'radio clipped to the shoulder with an antenna',
  slot: 'torso',
  colors: { color: 'black', trim: 'slateGrey' },
  boxes: [
    { color: 'color', at: [2, 5, 2], size: [1.4, 1.8, 0.8] },
    { color: 'trim', at: [2.4, 6.8, 2], size: [0.3, 1.6, 0.3] },
  ],
};

const BATON: AccessoryExtensionInput = {
  id: 'baton',
  description: 'short black baton',
  slot: 'hand',
  colors: { color: 'black' },
  boxes: [{ color: 'color', at: [0, -3.6, 0.5], size: [0.6, 3.8, 0.6] }],
};

const POLICE = {
  id: 'policeOfficer',
  label: 'Police officer',
  description: 'peaked cap with a badge, navy uniform, shoulder radio, baton',
  skin: 'brown',
  hair: { style: 'cropped', color: 'black' },
  headgear: 'peakedCap',
  top: { color: 'slateBlue' },
  layers: [{ id: 'tie', color: 'navy' }],
  legs: { color: 'navy' },
  shoes: { color: 'black' },
  accessories: ['badge', 'shoulderRadio'],
  held: 'baton',
};

function projectCast(): ProjectCast {
  return loadProjectCast({
    roles: [roleFile(FIREFIGHTER ?? {}), roleFile(POLICE)],
    accessories: [accessoryFile(RADIO), accessoryFile(BATON)],
  });
}

function kit(cast?: ProjectCast) {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(5), cast });
}

function geometry(character: CharacterObject): number[] {
  character.update(1.3);
  const values: number[] = [];
  character.traverse((node) => {
    values.push(node.position.x, node.position.y, node.rotation.x, node.rotation.z);
    if (node instanceof THREE.Mesh) {
      const position = (node.geometry as THREE.BufferGeometry).getAttribute('position');
      values.push(position.count, position.getX(0), position.getY(position.count - 1));
    }
  });
  return values;
}

describe('accessory extensions', () => {
  it('accepts a few connected boxes inside the slot and rejects floating or oversized ones', () => {
    expect(accessoryExtensionSchema.safeParse(RADIO).success).toBe(true);
    expect(accessoryExtensionSchema.safeParse(BATON).success).toBe(true);
    const floating = {
      ...RADIO,
      boxes: [...RADIO.boxes, { color: 'trim', at: [2, 9.5, 4.5], size: [0.5, 0.5, 0.5] }],
    };
    const parsed = accessoryExtensionSchema.safeParse(floating);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.message).join()).toMatch(/the box floats/);
    expect(floatingBoxes('torso', accessoryExtensionSchema.parse(RADIO).boxes)).toEqual([]);
    const outside = { ...BATON, boxes: [{ color: 'color', at: [0, -9, 0], size: [1, 9, 1] }] };
    expect(accessoryExtensionSchema.safeParse(outside).error?.issues[0]?.message).toMatch(
      /leaves the hand slot's area/,
    );
    const many = {
      ...RADIO,
      boxes: Array.from({ length: MAX_ACCESSORY_BOXES + 1 }, () => RADIO.boxes[0]),
    };
    expect(accessoryExtensionSchema.safeParse(many).success).toBe(false);
    const huge = { ...RADIO, boxes: [{ color: 'color', at: [0, 0, 0], size: [40, 1, 1] }] };
    expect(accessoryExtensionSchema.safeParse(huge).success).toBe(false);
    const offPalette = { ...RADIO, boxes: [{ color: '#ff0000', at: [2, 5, 2], size: [1, 1, 1] }] };
    expect(accessoryExtensionSchema.safeParse(offPalette).success).toBe(false);
  });

  it('reports files that clash with the vocabulary or the pack', () => {
    const { problems } = checkProjectCast({
      roles: [roleFile({ ...POLICE, id: 'engineer' }), roleFile(POLICE, 'police')],
      accessories: [accessoryFile({ ...RADIO, id: 'airTank' })],
    });
    expect(problems.map((problem) => problem.errors.join())).toEqual([
      expect.stringMatching(/"airTank" is already in the kit vocabulary/),
      expect.stringMatching(/"engineer" is a member of the pack/),
      expect.stringMatching(/id is "policeOfficer" but the file is police\.json/),
    ]);
  });
});

describe('project role files', () => {
  it('parses a role spec with notes and resolves project accessories', () => {
    const cast = projectCast();
    expect([...cast.roles.keys()]).toEqual(['firefighter', 'policeOfficer']);
    const parsed = parseRoleFile(roleFile({ ...CHEF, notes: 'Sous-chef in shot s04' }));
    expect(parsed).toMatchObject({ ok: true, role: { notes: 'Sous-chef in shot s04' } });
  });

  it('explains vocabulary mistakes with "did you mean" and cross-field hints', () => {
    const errors = (spec: object, cast?: ProjectCast): string[] => {
      const parsed = parseRoleFile(roleFile(spec), cast);
      return parsed.ok ? [] : [...parsed.problem.errors];
    };
    expect(errors({ ...POLICE, headgear: 'peakedcap' }, projectCast())).toEqual([
      'headgear: "peakedcap" is not in the vocabulary (did you mean "peakedCap"?); see reelforge kit-docs characters',
    ]);
    expect(errors({ ...CHEF, accessories: ['apron'] })).toEqual([
      'accessories.0: "apron" is not a accessories id ("apron" is a layer: put it in layers)',
    ]);
    expect(errors({ ...CHEF, held: 'radio' }).join()).toMatch(
      /held: "radio" is not in the vocabulary/,
    );
    expect(errors({ ...POLICE }).join()).toMatch(/"shoulderRadio" is not in the vocabulary/);
    expect(errors({ ...CHEF, top: { color: 'creme' } })).toEqual([
      expect.stringMatching(/^top\.color: use a pack swatch .* \(did you mean "cream"\?\)$/),
    ]);
    expect(errors({ ...CHEF, hat: 'chefHat' })).toEqual([
      '(spec): unknown field "hat" (use "headgear")',
    ]);
    expect(closestId('helmet', ['cap', 'fireHelmet'])).toBe('fireHelmet');
    expect(closestId('zebra', ['cap', 'fireHelmet'])).toBeUndefined();
  });

  it('leaves an invalid file out of a manifest; only a scene naming it gets the error', () => {
    const cast = loadProjectCast({
      roles: [
        roleFile(FIREFIGHTER ?? {}),
        { id: 'x', file: 'characters/roles/x.json', source: '{' },
      ],
      accessories: [],
    });
    expect([...cast.roles.keys()]).toEqual(['firefighter']);
    const { api } = kit(cast);
    expect(api.cast.person('firefighter')).toBeDefined();
    expect(() => api.cast.person('x')).toThrow(
      /characters\/roles\/x\.json is invalid \(not valid JSON .*reelforge cast check/,
    );
    expect(loadProjectCast(undefined).roles.size).toBe(0);
  });

  it('accepts the storyboard kebab-case ids', () => {
    const { api } = kit(projectCast());
    expect(api.cast.person('police-officer').anchorNames()).toContain('prop');
    expect(api.cast.spec('police-officer')).toMatchObject({ id: 'policeOfficer' });
  });
});

describe('kit.cast with project roles', () => {
  it('resolves project roles by id in person, role and spec, identical to the inline spec', () => {
    const cast = projectCast();
    const { api } = kit(cast);
    const byId = api.cast.role('firefighter', { seed: 3 });
    const asPerson = api.cast.person('firefighter', { seed: 3 });
    const inline = kit().api.cast.role(FIREFIGHTER, { seed: 3 });
    expect(geometry(byId)).toEqual(geometry(inline));
    expect(geometry(asPerson)).toEqual(geometry(inline));
    expect(api.cast.spec('policeOfficer')).toMatchObject({
      id: 'policeOfficer',
      held: { id: 'baton' },
    });
    expect(api.cast.spec('engineer')).toMatchObject({ id: 'engineer' });
  });

  it('draws project accessories on their slots, at the cast height', () => {
    const { api } = kit(projectCast());
    const officer = api.cast.person('policeOfficer');
    const plain = api.cast.role({ ...POLICE, accessories: ['badge'], held: undefined });
    officer.update(0);
    plain.update(0);
    const height = officer.bounds().max.y;
    expect(height).toBeGreaterThan(1.5);
    expect(height).toBeLessThan(2.1);
    expect(officer.anchor('prop').distanceTo(officer.anchor('hand'))).toBeLessThan(0.4);
    expect(geometry(officer)).not.toEqual(geometry(plain));
    expect(api.cast.person('policeOfficer', { held: 'none' })).toBeDefined();
  });

  it('names unknown people with a hint, and the kit without a project is unchanged', () => {
    const { api } = kit(projectCast());
    expect(() => api.cast.person('firefigher')).toThrow(/did you mean "firefighter"/);
    expect(() => api.cast.role('pilot')).toThrow(/characters\/roles\/pilot\.json/);
    expect(() => kit().api.cast.person('firefighter')).toThrow(KitError);
    for (const id of CAST) expect(kit().api.cast.person(id)).toBeDefined();
  });

  it('lists and documents the project roles and accessories', () => {
    const cast = projectCast();
    const listing = castListing(cast);
    expect(listing).toContainEqual(expect.objectContaining({ kind: 'role', id: 'policeOfficer' }));
    expect(listing).toContainEqual(expect.objectContaining({ kind: 'held', id: 'baton' }));
    expect(castListing().some((entry) => entry.kind === 'role')).toBe(false);
    const docs = charactersDocs(cast);
    expect(docs).toContain('project roles (characters/roles/<id>.json');
    expect(docs).toContain('  shoulderRadio (torso) — radio clipped to the shoulder');
    expect(charactersDocs()).not.toContain('project roles');
    expect(charactersDocs()).toContain('accessory extension (only when the vocabulary lacks');
  });

  it('covers common professions with the vocabulary (no extension needed)', () => {
    const { api } = kit();
    const professions = [
      {
        id: 'pilot',
        label: 'Pilot',
        headgear: { id: 'peakedCap', trim: 'cream' },
        top: { color: 'navy' },
        layers: [
          { id: 'suit', color: 'navy' },
          { id: 'tie', color: 'navy' },
        ],
        legs: { color: 'navy' },
        shoes: { color: 'black' },
        accessories: ['badge'],
        held: 'briefcase',
      },
      {
        id: 'farmer',
        label: 'Farmer',
        headgear: 'strawHat',
        top: { color: 'pink' },
        layers: ['overalls'],
        legs: { color: 'teal' },
        shoes: { style: 'boots', color: 'rust' },
        held: 'pitchfork',
      },
      {
        id: 'judge',
        label: 'Judge',
        hair: { style: 'bald', color: 'cream' },
        top: { color: 'black' },
        layers: ['robe'],
        legs: { color: 'black' },
        shoes: { color: 'black' },
        accessories: ['glassesRound'],
        held: 'gavel',
      },
      {
        id: 'courier',
        label: 'Courier',
        headgear: 'capBack',
        top: { color: 'orange' },
        legs: { style: 'shorts', color: 'darkSlate' },
        shoes: { color: 'cream' },
        accessories: ['backpack'],
        held: 'parcel',
      },
    ];
    for (const spec of professions) {
      const person = api.cast.role(spec);
      person.update(0);
      expect(person.bounds().max.y, spec.id).toBeGreaterThan(1.5);
      expect(person.bounds().max.y, spec.id).toBeLessThan(2.3);
    }
  });
});
