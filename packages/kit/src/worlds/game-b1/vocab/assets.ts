/**
 * Project asset files of the Game B1 world (PLAN.md#13.15): `assets/game-b1/<name>.json`, one stable,
 * versioned format the runtime Claude writes per film (the forest film's ranger, deer, canopy and
 * cabin) and the scene loads with `screen.assets(file)`:
 *   { "version": 1, "world": "game-b1", "describe": "...",
 *     "sprites":    { "<id>": <sprite DSL> },
 *     "playfields": { "<id>": <playfield DSL> },
 *     "generated":  { "<id>": { "kind": "tree" | "animal" | "person" | ..., ...traits } },
 *     "rooms":      { "<id>": <room DSL> } }
 * `checkB1Assets` validates every file of a project at once without throwing (readable sentences
 * naming the file and the id), knows the project's ids, and flags ids a scene uses that no file or
 * scene defines; `b1SceneRefs` reads those ids from a scene's source (string literals only).
 */
import { z } from 'zod';
import { interiorProblems } from '../room/interior.js';
import { interiorSchema } from '../room/interior-schema.js';
import { generatorSchema, runGenerator } from './gen/generators.js';
import { playfieldProblems } from './playfield.js';
import { nearIds, type Vocab } from './registry.js';
import { spriteProblems } from './sprite.js';

export const B1_ASSET_VERSION = 1;
const MAX_ENTRIES = 80;

export const b1AssetFileSchema = z.strictObject({
  version: z.literal(B1_ASSET_VERSION),
  world: z.literal('game-b1'),
  describe: z.string().max(240).optional(),
  sprites: z.record(z.string(), z.unknown()).default({}),
  playfields: z.record(z.string(), z.unknown()).default({}),
  generated: z.record(z.string(), z.unknown()).default({}),
  rooms: z.record(z.string(), z.unknown()).default({}),
});

export type B1AssetFile = z.input<typeof b1AssetFileSchema>;

export interface B1AssetIds {
  readonly sprites: readonly string[];
  readonly playfields: readonly string[];
  readonly rooms: readonly string[];
}

export interface B1AssetReport {
  readonly ids: B1AssetIds;
  readonly errors: readonly string[];
}

function generatedProblems(
  id: string,
  spec: unknown,
): { kind: 'sprite' | 'playfield'; problems: string[] } {
  const parsed = generatorSchema.safeParse(spec);
  if (!parsed.success)
    return {
      kind: 'sprite',
      problems: parsed.error.issues.map(
        (i) => `generated "${id}": ${i.path.join('.') || '(spec)'} ${i.message}`,
      ),
    };
  const made = runGenerator(id, parsed.data);
  return made.type === 'sprite'
    ? { kind: 'sprite', problems: spriteProblems(id, made.spec) }
    : { kind: 'playfield', problems: playfieldProblems(id, made.spec) };
}

/** Every problem of a project's asset files (name -> parsed JSON), and the ids they define. */
export function checkB1Assets(
  files: readonly { readonly name: string; readonly content: unknown }[],
  options: { readonly used?: Partial<B1AssetIds>; readonly known?: Partial<B1AssetIds> } = {},
): B1AssetReport {
  const used = options.used ?? {};
  const knownSprites = options.known?.sprites ?? [];
  const errors: string[] = [];
  const sprites: string[] = [];
  const playfields: string[] = [];
  const rooms: string[] = [];
  const owner = new Map<string, string>();
  const claim = (file: string, id: string): boolean => {
    const first = owner.get(id);
    if (first !== undefined) errors.push(`${file}: "${id}" is already defined in ${first}; ids are unique`);
    else owner.set(id, file);
    return first === undefined;
  };
  const roomSpecs: [string, string, unknown][] = [];
  for (const { name, content } of files) {
    const parsed = b1AssetFileSchema.safeParse(content);
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((i) => `${name}: ${i.path.join('.') || '(file)'} ${i.message}`));
      continue;
    }
    const f = parsed.data;
    const count = [f.sprites, f.playfields, f.generated, f.rooms].reduce((n, r) => n + Object.keys(r).length, 0);
    if (count > MAX_ENTRIES) errors.push(`${name}: ${String(count)} entries, at most ${String(MAX_ENTRIES)} per file (split it)`);
    for (const [id, spec] of Object.entries(f.sprites)) {
      errors.push(...spriteProblems(id, spec).map((m) => `${name}: ${m}`));
      if (claim(name, id)) sprites.push(id);
    }
    for (const [id, spec] of Object.entries(f.playfields)) {
      errors.push(...playfieldProblems(id, spec).map((m) => `${name}: ${m}`));
      if (claim(name, id)) playfields.push(id);
    }
    for (const [id, spec] of Object.entries(f.generated)) {
      const g = generatedProblems(id, spec);
      errors.push(...g.problems.map((m) => `${name}: ${m}`));
      if (claim(name, id)) (g.kind === 'sprite' ? sprites : playfields).push(id);
    }
    for (const [id, spec] of Object.entries(f.rooms)) {
      roomSpecs.push([name, id, spec]);
      if (claim(name, id)) rooms.push(id);
    }
  }
  for (const [name, id, spec] of roomSpecs) {
    const parsed = interiorSchema.safeParse(spec);
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((i) => `${name}: room "${id}": ${i.path.join('.') || '(spec)'} ${i.message}`));
      continue;
    }
    errors.push(...interiorProblems(parsed.data, (s) => sprites.includes(s) || knownSprites.includes(s)).map((m) => `${name}: room "${id}": ${m}`));
  }
  const unknown = (kind: string, list: readonly string[] | undefined, known: readonly string[]) => {
    for (const id of new Set(list ?? []))
      if (!known.includes(id)) {
        const near = nearIds(id, known);
        errors.push(`unknown ${kind} "${id}"${near.length > 0 ? ` (did you mean "${near[0] ?? ''}"?)` : ''}: define it in assets/game-b1/*.json or in the scene`);
      }
  };
  unknown('sprite', used.sprites, [...sprites, ...knownSprites]);
  unknown('playfield', used.playfields, [...playfields, ...(options.known?.playfields ?? [])]);
  unknown('room', used.rooms, [...rooms, ...(options.known?.rooms ?? [])]);
  return { ids: { sprites, playfields, rooms }, errors };
} // prettier-ignore

/** Loads one asset file into a screen's vocabulary (throws one message with every problem). */
export function loadB1Assets(vocab: Vocab, file: unknown, fail: (m: string) => never): B1AssetIds {
  const report = checkB1Assets([{ name: 'assets()', content: file }], {
    known: { sprites: [...vocab.sprites.keys()] },
  });
  if (report.errors.length > 0) fail(report.errors.join('\n'));
  const f = b1AssetFileSchema.parse(file);
  for (const [id, spec] of Object.entries(f.sprites)) vocab.defineSprite(id, spec);
  for (const [id, spec] of Object.entries(f.playfields)) vocab.definePlayfield(id, spec);
  for (const [id, spec] of Object.entries(f.generated)) vocab.generate(id, spec);
  for (const [id, spec] of Object.entries(f.rooms)) vocab.defineRoom(id, spec);
  return report.ids;
}

const LITERAL = String.raw`\(\s*['"]([a-zA-Z0-9-]+)['"]`;

/** Ids a scene defines and uses, read from string literals in its source (no execution). */
export function b1SceneRefs(source: string): { defines: string[]; uses: B1AssetIds } {
  const all = (pattern: string) =>
    [...source.matchAll(new RegExp(pattern + LITERAL, 'g'))].map((m) => m[1] ?? '');
  return {
    defines: [
      ...all(String.raw`\.defineSprite`),
      ...all(String.raw`\.definePlayfield`),
      ...all(String.raw`\.generate`),
    ],
    uses: {
      sprites: [...all(String.raw`\.draw`), ...all(String.raw`\.box`)],
      playfields: all(String.raw`\.field`),
      rooms: all(String.raw`\.interior`),
    },
  };
}
