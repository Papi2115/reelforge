/**
 * Post pass: palette quantization + 4x4 Bayer ordered dithering (see palette.ts for the
 * CPU reference). Output rows are flipped so that `readPixels` yields a top-down image,
 * i.e. the buffer can be fed straight to ffmpeg `-f rawvideo` without a vflip.
 */
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector3,
  type Texture,
} from 'three';
import { BAYER_4X4, DITHER_SPREAD, paletteRgb, type Rgb } from './palette.ts';

export interface PostPass {
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
}

const POST_VERTEX = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

function postFragment(paletteSize: number): string {
  const bayer = BAYER_4X4.map((value) => value.toFixed(1)).join(', ');
  return /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tScene;
uniform vec3 palette[${String(paletteSize)}];
uniform float spread;
uniform int height;
const float BAYER[16] = float[16](${bayer});
const vec3 LUMA = vec3(0.3, 0.59, 0.11);

void main() {
  ivec2 frag = ivec2(gl_FragCoord.xy);
  // Buffer row r holds image row r (top-down), sampled from scene row (height - 1 - r).
  vec3 color = texelFetch(tScene, ivec2(frag.x, height - 1 - frag.y), 0).rgb;
  int bayerIndex = (frag.y % 4) * 4 + (frag.x % 4);
  float offset = ((BAYER[bayerIndex] + 0.5) / 16.0 - 0.5) * spread;
  vec3 shifted = color + vec3(offset);
  vec3 best = palette[0];
  float bestDistance = 1e9;
  for (int i = 0; i < ${String(paletteSize)}; i++) {
    vec3 delta = shifted - palette[i];
    float dist2 = dot(LUMA, delta * delta);
    if (dist2 < bestDistance) {
      bestDistance = dist2;
      best = palette[i];
    }
  }
  gl_FragColor = vec4(best, 1.0);
}`;
}

export function createPostPass(sceneTexture: Texture, height: number): PostPass {
  const palette: Rgb[] = paletteRgb();
  const material = new ShaderMaterial({
    vertexShader: POST_VERTEX,
    fragmentShader: postFragment(palette.length),
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tScene: { value: sceneTexture },
      palette: { value: palette.map(([r, g, b]) => new Vector3(r, g, b)) },
      spread: { value: DITHER_SPREAD },
      height: { value: height },
    },
  });
  const scene = new Scene();
  scene.add(new Mesh(new PlaneGeometry(2, 2), material));
  return { scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) };
}
