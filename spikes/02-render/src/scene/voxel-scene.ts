/**
 * Tiny "Voxel Pixel" test scene. Contract: `update(t)` sets EVERY time-dependent property
 * from `t` alone (absolute, never incremental), so `update(t)` is a pure function of time.
 * Randomness comes only from the seeded RNG at construction time.
 */
import {
  BackSide,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { createRng } from '../rng.ts';

export interface VoxelScene {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  update(t: number): void;
}

interface FloatingCube {
  readonly mesh: Mesh;
  readonly baseY: number;
  readonly bobAmplitude: number;
  readonly bobFrequency: number;
  readonly phase: number;
  readonly spinX: number;
  readonly spinY: number;
}

const GRID_CELL = 2;
const GRID_SPEED = 3;
const CUBE_COLORS = ['#ff3cac', '#2ec4b6', '#ff8c42', '#7fe39a', '#b0279b', '#f4e9d8'];

const SKY_VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAGMENT = /* glsl */ `
varying vec3 vDirection;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 glowColor;
void main() {
  float h = clamp(vDirection.y, 0.0, 1.0);
  vec3 sky = mix(horizonColor, topColor, pow(h, 0.6));
  sky = mix(sky, glowColor, exp(-h * 18.0) * 0.8);
  gl_FragColor = vec4(sky, 1.0);
}`;

function lambert(color: string): MeshLambertMaterial {
  return new MeshLambertMaterial({ color: new Color(color), flatShading: true });
}

function voxel(size: readonly [number, number, number], color: string): Mesh {
  return new Mesh(new BoxGeometry(size[0], size[1], size[2]), lambert(color));
}

function createHero(): Group {
  const hero = new Group();
  const parts: readonly [readonly [number, number, number], string, number, number][] = [
    [[0.5, 1.0, 0.5], '#3c4256', -0.3, 0.5],
    [[0.5, 1.0, 0.5], '#3c4256', 0.3, 0.5],
    [[1.3, 1.3, 0.8], '#ff8c42', 0, 1.65],
    [[0.9, 0.9, 0.9], '#f4e9d8', 0, 2.75],
    [[0.35, 1.1, 0.35], '#ff8c42', -0.85, 1.7],
    [[0.35, 1.1, 0.35], '#ff8c42', 0.85, 1.7],
  ];
  for (const [size, color, x, y] of parts) {
    const part = voxel(size, color);
    part.position.set(x, y, 0);
    hero.add(part);
  }
  return hero;
}

function createSky(): Mesh {
  const material = new ShaderMaterial({
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new Color('#0b0f2a') },
      horizonColor: { value: new Color('#2d1b69') },
      glowColor: { value: new Color('#b0279b') },
    },
  });
  return new Mesh(new SphereGeometry(150, 32, 16), material);
}

function createFloatingCubes(seed: number, count: number): FloatingCube[] {
  const rng = createRng(seed);
  const cubes: FloatingCube[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = 5 + rng() * 14;
    const size = 0.3 + rng() * 0.9;
    const color = CUBE_COLORS[Math.floor(rng() * CUBE_COLORS.length)] ?? '#ff3cac';
    const mesh = voxel([size, size, size], color);
    mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    cubes.push({
      mesh,
      baseY: 1 + rng() * 6,
      bobAmplitude: 0.2 + rng() * 0.8,
      bobFrequency: 0.5 + rng() * 1.5,
      phase: rng() * Math.PI * 2,
      spinX: (rng() - 0.5) * 2,
      spinY: (rng() - 0.5) * 2,
    });
  }
  return cubes;
}

function createSkyline(seed: number): Group {
  const rng = createRng(seed ^ 0x5eed);
  const skyline = new Group();
  for (let index = 0; index < 28; index += 1) {
    const angle = (index / 28) * Math.PI * 2 + rng() * 0.1;
    const height = 3 + rng() * 12;
    const tower = voxel(
      [2 + rng() * 2, height, 2 + rng() * 2],
      rng() > 0.5 ? '#12355b' : '#2d1b69',
    );
    tower.position.set(Math.cos(angle) * 60, height / 2, Math.sin(angle) * 60);
    skyline.add(tower);
  }
  return skyline;
}

export function createVoxelScene(seed: number, aspect: number): VoxelScene {
  const scene = new Scene();
  scene.fog = new Fog(new Color('#1a1446'), 25, 90);
  scene.add(new HemisphereLight(new Color('#7f8cff'), new Color('#2d1b69'), 1.2));
  const sun = new DirectionalLight(new Color('#ffd9b0'), 2.2);
  sun.position.set(6, 10, 4);
  scene.add(sun);
  scene.add(createSky());

  const floor = new Mesh(
    new PlaneGeometry(400, 400),
    new MeshBasicMaterial({ color: new Color('#0b0f2a') }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new GridHelper(160, 80, new Color('#ff3cac'), new Color('#b0279b'));
  grid.position.y = 0.01;
  scene.add(grid);
  scene.add(createSkyline(seed));

  const hero = createHero();
  scene.add(hero);
  const cubes = createFloatingCubes(seed, 40);
  for (const cube of cubes) scene.add(cube.mesh);

  const camera = new PerspectiveCamera(50, aspect, 0.1, 400);

  function update(t: number): void {
    grid.position.z = (((t * GRID_SPEED) % GRID_CELL) + GRID_CELL) % GRID_CELL;
    hero.position.y = Math.abs(Math.sin(t * 3)) * 0.4;
    hero.rotation.y = Math.sin(t * 0.7) * 0.6;
    for (const cube of cubes) {
      cube.mesh.position.y =
        cube.baseY + Math.sin(t * cube.bobFrequency + cube.phase) * cube.bobAmplitude;
      cube.mesh.rotation.set(cube.spinX * t, cube.spinY * t, 0);
    }
    const orbit = t * 0.35;
    const radius = 13 - Math.sin(t * 0.3) * 3;
    camera.position.set(
      Math.cos(orbit) * radius,
      4 + Math.sin(t * 0.5) * 1.5,
      Math.sin(orbit) * radius,
    );
    camera.lookAt(0, 1.8, 0);
    camera.updateMatrixWorld(true);
  }

  update(0);
  return { scene, camera, update };
}
