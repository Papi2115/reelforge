/**
 * Creative directions for shot variants (PLAN.md#11.3, docs/shot-variants.md): each variant of a
 * shot is built from a different direction so the alternatives really differ (composition,
 * camera, how much text vs 3D). The library is data; a set takes consecutive entries, rotated by
 * the shot's variant round, so the same request always gets the same directions and a new round
 * offers new ones. Ordered so that neighbours differ as much as possible.
 */
import type { VariantDirectionRef } from '@reelforge/shared';

export interface VariantDirection extends VariantDirectionRef {
  /** Sent to the scene-build turn: what makes this variant different. */
  readonly brief: string;
}

export const VARIANT_DIRECTIONS: readonly VariantDirection[] = [
  {
    id: 'hero-push',
    label: 'Hero object, slow push-in',
    brief:
      'One hero object (the most important kit prop for the narration) large and centred, everything else secondary and simple, against a calm styled backdrop (a kit environment or the palette sky, never an empty black void). Slow continuous push-in toward it; on the key word the object reacts (turn, pop, light change). Calm, focused, few elements.',
  },
  {
    id: 'orbit-depth',
    label: 'Orbit, layered depth',
    brief:
      'Camera orbits the subject (a clear arc, not a push). Build foreground, midground and background layers with small floating elements drifting at different depths so the parallax reads. Rich, spatial, more objects than usual.',
  },
  {
    id: 'kinetic-text',
    label: 'Text-forward kinetic',
    brief:
      'Text leads: the key words land as large pixel-font cards on their anchors (staggered, punchy), minimal 3D behind them (a simple backdrop, at most one or two small props). Camera nearly still, only a slow drift. Graphic and readable on a phone.',
  },
  {
    id: 'diorama-wide',
    label: 'Wide diorama',
    brief:
      'A wide, high establishing view of a small voxel world (environment plus several props telling the story). Slow sideways truck or pan across it; on the key word one detail of the diorama is highlighted (light, colour or motion).',
  },
  {
    id: 'macro-reveal',
    label: 'Macro detail, then reveal',
    brief:
      'Start very close on one detail (a part, a texture, an edge) so the viewer cannot tell what it is; on the key word pull back fast to reveal the whole object or scene. Strong change of scale.',
  },
  {
    id: 'build-up',
    label: 'Build-up sequence',
    brief:
      'Objects appear one after another in rhythm with the spoken words (each pops in on its own anchor), stacking, counting or assembling into the final picture. Camera tracks sideways to follow the sequence.',
  },
  {
    id: 'contrast',
    label: 'Contrast / transformation',
    brief:
      'Two states side by side or one turning into the other (before/after, small/big, old/new): symmetric framing, a clear swing or whip of the camera from one side to the other on the key word.',
  },
  {
    id: 'low-dramatic',
    label: 'Low angle, dramatic light',
    brief:
      'Low camera looking up at the subject, strong key light with deep shadows (darker palette slots), slow rising camera. One punchy accent (flash, shake or sudden light) on the key word. Bold and cinematic.',
  },
];

/**
 * `count` directions for a shot's variant round: consecutive library entries starting at
 * `round * count`, wrapping around. Pure: the same round always gives the same directions.
 */
export function pickDirections(
  count: number,
  round: number,
  library: readonly VariantDirection[] = VARIANT_DIRECTIONS,
): VariantDirection[] {
  if (library.length === 0) return [];
  const size = Math.max(1, Math.min(Math.floor(count), library.length));
  const start = (Math.max(0, Math.floor(round)) * size) % library.length;
  return Array.from({ length: size }, (_, offset) => {
    const direction = library[(start + offset) % library.length];
    if (direction === undefined) throw new Error('direction library index out of range');
    return direction;
  });
}

export function directionById(id: string): VariantDirection | undefined {
  return VARIANT_DIRECTIONS.find((direction) => direction.id === id);
}
