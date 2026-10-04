import { describe, expect, it } from 'vitest';
import { validateRoleFile } from './roles.js';

const CHEF = {
  id: 'chef',
  label: 'Chef',
  headgear: 'chefHat',
  top: { color: 'cream' },
  layers: ['chefJacket'],
  legs: { color: 'darkSlate' },
  shoes: { color: 'black' },
  held: 'spatula',
  notes: 'head chef of shot s03',
};

const codes = (text: string, roleId = 'chef'): string[] =>
  validateRoleFile(text, { roleId }).issues.map((entry) => entry.code);

describe('validateRoleFile', () => {
  it('accepts a role spec with notes', () => {
    const result = validateRoleFile(JSON.stringify(CHEF), { roleId: 'chef' });
    expect(result.valid).toBe(true);
    expect(result.value?.['label']).toBe('Chef');
  });

  it('reports broken JSON, a wrong id, missing and unknown fields', () => {
    expect(codes('{ "id": "chef", ')).toEqual(['role-json']);
    expect(codes('[]')).toEqual(['role-object']);
    expect(codes(JSON.stringify(CHEF), 'cook')).toEqual(['role-id']);
    expect(codes(JSON.stringify({ ...CHEF, top: undefined, hat: 'chefHat', notes: 3 }))).toEqual([
      'role-field',
      'role-unknown-field',
      'role-notes',
    ]);
  });
});
