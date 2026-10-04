/**
 * Builds a side-cast person from a role spec (ADR-024): the page's castBody (body preset ->
 * proportions, top + skin head + two-dot eyes) followed by the vocabulary items in a fixed order
 * (layers, hair, headgear, accessories, held prop), each drawing its boxes on the joints. The ten
 * cast members are presets of this builder, so a new profession is a sibling of the pack.
 */
import type { KitTools } from '../registry.js';
import type { Vec3 } from '../types.js';
import type { CharacterBuild, HeldPoint } from './build.js';
import { INK } from './face.js';
import { DEFAULT_HAND_H, humanoid } from './humanoid.js';
import { buildRig, type BodySpec, type JointDef } from './rig.js';
import type { ShapeSet } from './shape.js';
import {
  ACCESSORY_TABLE,
  HAIR_TABLE,
  HEADGEAR_TABLE,
  HELD_TABLE,
  LAYER_TABLE,
  SKIN_COLORS,
  slotColor,
  type AnyRoleSpec,
  type BodyPreset,
  type ItemRef,
} from './role-spec.js';
import type { BodyAdjust, ColorSlot, Dims, HeldItem, RoleItem } from './role-types.js';

const UNIT = 1 / 12;

/** Accessory and held-prop tables a role draws from: the kit's own, or with project extensions. */
export interface RoleVocabulary {
  readonly accessories: ReadonlyMap<string, RoleItem>;
  readonly held: ReadonlyMap<string, HeldItem>;
}

export const KIT_VOCABULARY: RoleVocabulary = { accessories: ACCESSORY_TABLE, held: HELD_TABLE };
/** Joint of the held prop (child of the holding forearm, no offset). */
const PROP_JOINT = 'prop';

interface Proportions {
  readonly torsoH?: number;
  readonly torsoW?: number;
  readonly torsoD?: number;
  readonly leg?: number;
  readonly upper?: number;
  readonly fore?: number;
  readonly armW?: number;
  readonly legW?: number;
  readonly eyeY?: number;
}

const PRESETS: Readonly<Record<BodyPreset, Proportions>> = {
  standard: {},
  tall: { torsoH: 8.5, torsoW: 5.6, leg: 7 },
  broad: { torsoW: 7, torsoD: 5 },
  kid: {
    leg: 5,
    torsoH: 5,
    torsoW: 5,
    torsoD: 3.6,
    upper: 2.2,
    fore: 2.2,
    armW: 1.8,
    legW: 2.2,
    eyeY: 3,
  },
  bulky: { torsoW: 8, torsoD: 5, armW: 2.6, legW: 3 },
};

interface Placed {
  readonly item: RoleItem;
  readonly ref: ItemRef;
}

function lookup(table: ReadonlyMap<string, RoleItem>, ref: ItemRef): Placed | undefined {
  const item = table.get(ref.id);
  return item === undefined ? undefined : { item, ref };
}

/** Sum of the items' adjustments (booleans: any; slots: the last item that sets one). */
function adjustments(
  items: readonly Placed[],
): BodyAdjust & { readonly from: Partial<Record<'sleeves' | 'hands', Placed>> } {
  let armW = 0;
  let headD = 0;
  let eyeX = 0;
  let eyeY = 0;
  let coversHead = false;
  let hidesEyes = false;
  const from: Partial<Record<'sleeves' | 'hands', Placed>> = {};
  for (const placed of items) {
    const adjust = placed.item.adjust;
    if (!adjust) continue;
    armW += adjust.armW ?? 0;
    headD += adjust.headD ?? 0;
    eyeX += adjust.eyeX ?? 0;
    eyeY += adjust.eyeY ?? 0;
    coversHead ||= adjust.coversHead === true;
    hidesEyes ||= adjust.hidesEyes === true;
    if (adjust.sleeves) from.sleeves = placed;
    if (adjust.hands) from.hands = placed;
  }
  return { armW, headD, eyeX, eyeY, coversHead, hidesEyes, from };
}

function slotOf(placed: Placed | undefined, which: 'sleeves' | 'hands', fallback: string): string {
  const slot: ColorSlot | undefined = placed?.item.adjust?.[which];
  if (!placed || !slot) return fallback;
  return slotColor(placed.item, placed.ref, slot) ?? fallback;
}

export function buildRole(
  tools: KitTools,
  spec: AnyRoleSpec,
  vocabulary: RoleVocabulary = KIT_VOCABULARY,
): CharacterBuild {
  const p = PRESETS[spec.body];
  const layers = spec.layers.map((ref) => lookup(LAYER_TABLE, ref)).filter((x) => x !== undefined);
  const hair = lookup(HAIR_TABLE, { id: spec.hair.style, color: spec.hair.color });
  const headgear = lookup(HEADGEAR_TABLE, spec.headgear);
  const accessories = spec.accessories
    .map((ref) => lookup(vocabulary.accessories, ref))
    .filter((x) => x !== undefined);
  const items = [
    ...layers,
    ...(hair ? [hair] : []),
    ...(headgear ? [headgear] : []),
    ...accessories,
  ];
  const adjust = adjustments(items);
  const skin = SKIN_COLORS[spec.skin];
  const th = p.torsoH ?? 7;
  const tw = p.torsoW ?? 6;
  const td = p.torsoD ?? 4;
  const hw = 8;
  const hh = 7;
  const hd = 7 + (adjust.headD ?? 0);
  const aw = (p.armW ?? 2) + (adjust.armW ?? 0);
  const leg = p.leg ?? 6;
  const upper = p.upper ?? 3;
  const body: BodySpec = {
    unit: UNIT,
    leg,
    thigh: leg / 2,
    hipX: 1.4,
    shoulderX: tw / 2 + aw / 2,
    shoulderY: th - 1,
    upper,
    fore: p.fore,
    neckY: th,
  };
  const boots = spec.shoes.style === 'boots';
  const shapes = humanoid(body, {
    sleeve: slotOf(adjust.from.sleeves, 'sleeves', spec.top.color),
    hand: slotOf(adjust.from.hands, 'hands', skin),
    pants: spec.legs.color,
    shin: spec.legs.style === 'shorts' ? skin : undefined,
    shoe: spec.shoes.color,
    armW: aw,
    legW: p.legW ?? 2.6,
    toe: boots ? 1.2 : 0.8,
    shoeH: boots ? 1.6 : 1,
  });
  shapes('torso').cb(spec.top.color, [0, 0, 0], [tw, th, td]);
  if (adjust.coversHead !== true) shapes('neck').cb(skin, [0, 0, 0], [hw, hh, hd]);
  const extra: JointDef[] = [];
  const eyeY = (p.eyeY ?? 3.2) + (adjust.eyeY ?? 0);
  if (spec.eyes.style !== 'none' && adjust.hidesEyes !== true) {
    const ex = 1.6 + (adjust.eyeX ?? 0);
    const glow = spec.eyes.style === 'glow';
    const color = spec.eyes.color ?? (glow ? 'green' : INK);
    const channel = glow ? 'glow' : 'lit';
    shapes('eyes')
      .cb(color, [-ex, -0.65, 0], [1, 1.3, 0.3], channel)
      .cb(color, [ex, -0.65, 0], [1, 1.3, 0.3], channel);
    extra.push(['eyes', 'neck', 0, eyeY, hd / 2]);
  }
  const d: Dims = { th, tw, td, hw, hh, hd, aw, fore: p.fore ?? upper };
  const hairColor = spec.hair.color ?? hair?.item.colors.color ?? INK;
  const draw = ({ item, ref }: Placed, target: ShapeSet = shapes, mirror: 1 | -1 = 1): void => {
    const color = slotColor(item, ref, 'color') ?? spec.top.color;
    item.draw({
      shapes: target,
      d,
      color,
      trim: slotColor(item, ref, 'trim') ?? color,
      detail: slotColor(item, ref, 'detail') ?? color,
      under: spec.top.color,
      hair: hairColor,
      mirror,
    });
  };
  for (const placed of items) draw(placed);
  let held: HeldPoint | undefined;
  const heldItem = spec.held ? vocabulary.held.get(spec.held.id) : undefined;
  if (spec.held && heldItem) {
    // The prop gets its own joint on the holding forearm, so its centre (the 'prop' anchor) is
    // known; the item draws into it whichever forearm it names.
    const hand = spec.held.hand ?? heldItem.hand;
    const onProp = Object.assign(() => shapes(PROP_JOINT), { map: shapes.map });
    draw({ item: heldItem, ref: spec.held }, onProp, hand === heldItem.hand ? 1 : -1);
    extra.push([PROP_JOINT, hand === 'left' ? 'elL' : 'elR', 0, 0, 0]);
    held = { joint: PROP_JOINT, point: centre(shapes(PROP_JOINT).bounds()) };
  }
  const rig = buildRig(tools, body, shapes, extra);
  const fore = p.fore ?? upper;
  return {
    id: spec.id,
    rig,
    energy: 0.45,
    blinkEyes: rig.joints['eyes'],
    headTop: [0, hh, 0],
    faceAt: [0, eyeY, hd / 2],
    hand: [0, -fore + DEFAULT_HAND_H / 2, 0],
    held,
  };
}

/** Centre of voxel bounds (the origin when empty). */
function centre(bounds: { readonly min: Vec3; readonly max: Vec3 } | undefined): Vec3 {
  if (!bounds) return [0, 0, 0];
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}
