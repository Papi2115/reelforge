import { describe, expect, it } from 'vitest';
import {
  castFileOf,
  castRoleFile,
  castRoleId,
  manifestCastRolesSchema,
  rolesReportSchema,
} from './cast-roles.js';
import { renderManifestSchema } from './render-manifest.js';

const entry = (id: string) => ({ id, file: castRoleFile(id), source: '{}' });

describe('project roles (shared)', () => {
  it('maps storyboard names to role ids and files back to ids', () => {
    expect(castRoleId('firefighter')).toBe('firefighter');
    expect(castRoleId('police-officer')).toBe('policeOfficer');
    expect(castRoleId('Air traffic controller')).toBe('airTrafficController');
    expect(castRoleId('—')).toBeUndefined();
    expect(castRoleId('a'.repeat(40))).toBeUndefined();
    expect(castFileOf('characters/roles/chef.json')).toEqual({ kind: 'role', id: 'chef' });
    expect(castFileOf('characters\\accessories\\baton.json')).toEqual({
      kind: 'accessory',
      id: 'baton',
    });
    expect(castFileOf('characters/roles/Bad-Name.json')).toBeUndefined();
    expect(castFileOf('scenes/s01.js')).toBeUndefined();
  });

  it('validates the manifest field (no duplicate ids) and keeps it optional', () => {
    expect(
      manifestCastRolesSchema.safeParse({ roles: [entry('chef')], accessories: [] }).success,
    ).toBe(true);
    const duplicate = manifestCastRolesSchema.safeParse({
      roles: [entry('chef'), entry('chef')],
      accessories: [],
    });
    expect(duplicate.error?.issues[0]?.message).toBe('duplicate role "chef"');
    const manifest = {
      version: 1,
      fps: 30,
      seed: 1,
      shots: [{ id: 's01', t0: 0, t1: 1, scene: { file: 'scenes/s01.js', source: 'x' } }],
    };
    expect(renderManifestSchema.parse(manifest)).not.toHaveProperty('castRoles');
    expect(
      renderManifestSchema.parse({
        ...manifest,
        castRoles: { roles: [entry('chef')], accessories: [] },
      }).castRoles?.roles,
    ).toHaveLength(1);
  });

  it('parses a roles report', () => {
    const report = {
      version: 1,
      updatedAt: '2026-10-04T10:00:00.000Z',
      roles: [
        {
          id: 'chef',
          status: 'warning',
          file: 'characters/roles/chef.json',
          description: 'toque, jacket, spatula',
          shots: ['s01'],
          attempts: 2,
          accessories: [],
          findings: ['height: 2.60 units tall'],
          notes: [],
          updatedAt: '2026-10-04T10:00:00.000Z',
        },
      ],
    };
    expect(rolesReportSchema.parse(report).roles[0]?.status).toBe('warning');
  });
});
