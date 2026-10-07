/**
 * The film's own vocabulary for one `b1Screen` (PLAN.md#13.15): sprites and playfields defined by
 * hand (the DSLs), by the seeded generators, or loaded from the project's asset files
 * (`assets/game-b1/*.json`), plus named room interiors. Ids are unique across kinds; an unknown id
 * answers with the ids that exist and a did-you-mean.
 */
import { compilePlayfield, type B1Playfield } from './playfield.js';
import { compileSprite, type B1Sprite } from './sprite.js';
import { generatorSchema, runGenerator } from './gen/generators.js';

export const MAX_IDS = 200;

/** Ids within edit distance 2 of `id`, closest first. */
export function nearIds(id: string, known: Iterable<string>): string[] {
  const distance = (a: string, b: string): number => {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0] ?? 0;
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const current = row[j] ?? 0;
        row[j] = Math.min(
          current + 1,
          (row[j - 1] ?? 0) + 1,
          previous + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
        previous = current;
      }
    }
    return row[b.length] ?? 0;
  };
  return [...known]
    .map((k) => [k, distance(id.toLowerCase(), k.toLowerCase())] as const)
    .filter(([, d]) => d <= 2)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k);
}

export type Fail = (message: string) => never;

export class Vocab {
  readonly sprites = new Map<string, B1Sprite>();
  readonly playfields = new Map<string, B1Playfield>();
  readonly rooms = new Map<string, unknown>();

  constructor(private readonly fail: Fail) {}

  private claim(id: string, what: string): void {
    if (this.sprites.has(id) || this.playfields.has(id) || this.rooms.has(id))
      this.fail(`${what}("${id}"): "${id}" is already defined; every vocabulary id is unique`);
    if (this.sprites.size + this.playfields.size + this.rooms.size >= MAX_IDS)
      this.fail(`${what}("${id}"): more than ${String(MAX_IDS)} vocabulary ids in one shot`);
  }

  defineSprite(id: string, spec: unknown): B1Sprite {
    this.claim(id, 'defineSprite');
    const sprite = compileSprite(id, spec, (m) => this.fail(`defineSprite("${id}"):\n${m}`));
    this.sprites.set(id, sprite);
    return sprite;
  }

  definePlayfield(id: string, spec: unknown): B1Playfield {
    this.claim(id, 'definePlayfield');
    const field = compilePlayfield(id, spec, (m) => this.fail(`definePlayfield("${id}"):\n${m}`));
    this.playfields.set(id, field);
    return field;
  }

  generate(id: string, spec: unknown): B1Sprite | B1Playfield {
    const parsed = generatorSchema.safeParse(spec);
    if (!parsed.success)
      this.fail(
        `generate("${id}"): ${parsed.error.issues.map((i) => `${i.path.join('.') || '(spec)'} ${i.message}`).join('; ')}`,
      );
    const made = runGenerator(id, parsed.data);
    return made.type === 'sprite'
      ? this.defineSprite(id, made.spec)
      : this.definePlayfield(id, made.spec);
  }

  defineRoom(id: string, spec: unknown): void {
    this.claim(id, 'room');
    this.rooms.set(id, spec);
  }

  private unknown(kind: string, id: string, known: Iterable<string>): never {
    const list = [...known];
    const near = nearIds(id, list);
    const hint = near.length > 0 ? ` Did you mean ${near.map((n) => `"${n}"`).join(', ')}?` : '';
    const defined = list.length > 0 ? `defined: ${list.join(', ')}` : 'none defined yet';
    this.fail(
      `no ${kind} "${id}" (${defined}).${hint} Define it with screen.define${kind === 'sprite' ? 'Sprite' : 'Playfield'}(), screen.generate() or in an assets/game-b1/*.json file`,
    );
  }

  sprite(id: string): B1Sprite {
    return this.sprites.get(id) ?? this.unknown('sprite', id, this.sprites.keys());
  }

  playfield(id: string): B1Playfield {
    return this.playfields.get(id) ?? this.unknown('playfield', id, this.playfields.keys());
  }

  room(id: string): unknown {
    return this.rooms.get(id) ?? this.unknown('room', id, this.rooms.keys());
  }
}
