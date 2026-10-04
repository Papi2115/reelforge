/**
 * What a character builder hands to the character runtime (character.ts): the rig, its
 * personality (energy), the face (mascots), the blinking eye joint (cast), secondary motion and
 * the voxel points the anchors follow.
 */
import type * as THREE from 'three';
import type { Vec3 } from '../types.js';
import type { Expression, Pose } from './clips.js';
import type { Face } from './face.js';
import type { Rig } from './rig.js';

/** Inputs of secondary motion (tail, ears, scarf, antenna, tuft, bulb glow). */
export interface SecondaryInput {
  readonly pose: Pose;
  /** Global time (scene time + the character's phase). */
  readonly time: number;
  /** Vertical hip velocity proxy (page: hipY change over 0.1 s, halved). */
  readonly velocity: number;
  readonly expression: Expression;
}

export interface HeldPoint {
  /** Joint carrying the held prop (a child of the holding forearm). */
  readonly joint: string;
  /** Centre of the held prop in that joint's space (voxels). */
  readonly point: Vec3;
}

export interface CharacterBuild {
  readonly id: string;
  readonly rig: Rig;
  /** Personality 0..1: mascots 1 (Screen 0.8), cast 0.45, mannequin 0.25. */
  readonly energy: number;
  /** Mascot face (expressions + blink). */
  readonly face?: Face | undefined;
  /** Joint whose y scale blinks (the cast's two-dot eyes). */
  readonly blinkEyes?: THREE.Object3D | undefined;
  readonly secondary?: ((input: SecondaryInput) => void) | undefined;
  /** Realistic arm length: think/eureka fold the hand to the chin (mannequin). */
  readonly longArms?: boolean | undefined;
  /** Top of the head and the face centre, in the neck joint's space (voxels). */
  readonly headTop: Vec3;
  readonly faceAt: Vec3;
  /** Hand centre in a forearm joint's space (voxels). */
  readonly hand: Vec3;
  readonly held?: HeldPoint | undefined;
}
