import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { KitError } from '../errors.js';
import { createKit } from '../kit.js';
import { CRISP_PALETTE } from '../testing/palettes.js';
import { testRng } from '../testing/rng.js';

function kit() {
  return createKit({ three: THREE, palette: CRISP_PALETTE, rng: testRng(4) }).api;
}

function colorsOf(root: THREE.Object3D, name: string): number[] {
  const mesh = root.getObjectByName(name);
  if (!(mesh instanceof THREE.Mesh)) throw new Error(`no mesh ${name}`);
  return Array.from((mesh.geometry as THREE.BufferGeometry).getAttribute('color').array);
}

function rotations(root: THREE.Object3D): number[] {
  const values: number[] = [];
  root.traverse((child) => values.push(child.rotation.x, child.rotation.y, child.rotation.z));
  return values;
}

describe('prop animation hooks (pure functions of their arguments)', () => {
  it('calculator: modes, text, glitch and doom animation via screen', () => {
    const calc = kit().props.calculator({ text: '61 KB' });
    const text = colorsOf(calc, 'calculator.screen');
    expect(calc.screen.width).toBe(44);
    calc.screen.glitch(1);
    expect(colorsOf(calc, 'calculator.screen')).not.toEqual(text);
    calc.screen.glitch(0);
    expect(colorsOf(calc, 'calculator.screen')).toEqual(text);
    calc.screen.setMode('doom');
    calc.update(0.3);
    const doom = colorsOf(calc, 'calculator.screen');
    calc.update(2.1);
    expect(colorsOf(calc, 'calculator.screen')).not.toEqual(doom);
    calc.update(0.3);
    expect(colorsOf(calc, 'calculator.screen')).toEqual(doom);
    expect(() => {
      calc.screen.setMode('code');
    }).toThrow(/unknown mode \(available: blank, text, doom, glitch\)/);
    expect(() => {
      calc.screen.glitch(Number.NaN);
    }).toThrow(KitError);
  });

  it('laptop: open(amount) swings the lid between closed (flat) and open', () => {
    const laptop = kit().props.laptop({ open: 0 });
    const closedHeight = laptop.bounds().max.y;
    laptop.open(1);
    expect(laptop.bounds().max.y).toBeGreaterThan(closedHeight * 4);
    laptop.open(0);
    expect(laptop.bounds().max.y).toBeCloseTo(closedHeight);
    expect(closedHeight).toBeCloseTo(5 / 32);
  });

  it('phone: screenOn(false) darkens the screen, true restores it', () => {
    const phone = kit().props.phone();
    const on = colorsOf(phone, 'phone.screen');
    phone.screenOn(false);
    expect(new Set(colorsOf(phone, 'phone.screen')).size).toBeLessThanOrEqual(3);
    phone.screenOn(true);
    expect(colorsOf(phone, 'phone.screen')).toEqual(on);
  });

  it('server: blink(t) depends only on t; alarm switches every LED', () => {
    const server = kit().props.server({ units: 4 });
    server.blink(1.25);
    const at = colorsOf(server, 'server.leds');
    server.blink(3.7);
    expect(colorsOf(server, 'server.leds')).not.toEqual(at);
    server.update(1.25);
    expect(colorsOf(server, 'server.leds')).toEqual(at);
    server.alarm(1);
    expect(new Set(colorsOf(server, 'server.leds')).size).toBeLessThanOrEqual(3);
  });

  it('clock: setTime poses the hands clockwise, update(t) runs from the start time', () => {
    const clock = kit().props.clock({ time: '00:00', speed: 3600 });
    clock.setTime(3, 0, 0);
    const hourHand = clock.children[1];
    expect(hourHand?.rotation.z).toBeCloseTo(-Math.PI / 2);
    clock.update(6);
    expect(hourHand?.rotation.z).toBeCloseTo(-Math.PI);
    const poses = rotations(clock);
    clock.update(1);
    clock.update(6);
    expect(rotations(clock)).toEqual(poses);
  });

  it('globe, lock, folder and map table hooks are absolute', () => {
    const api = kit();
    const globe = api.props.globe({ speed: 1 });
    globe.update(2);
    const spun = rotations(globe);
    globe.spin(0);
    globe.update(2);
    expect(rotations(globe)).toEqual(spun);
    const lock = api.props.lock();
    const lockedTop = lock.bounds().max.y;
    lock.unlock(0.5);
    expect(lock.bounds().max.y).toBeCloseTo(lockedTop + 4 / 32);
    lock.unlock(1);
    expect(lock.children[1]?.rotation.y).toBeCloseTo(Math.PI / 2);
    const folder = api.props.folder();
    folder.open(1);
    expect(folder.children[1]?.rotation.z).toBeCloseTo(Math.PI);
    const table = api.props.mapTable({
      pins: [
        [0.2, 0.2],
        [0.8, 0.8],
      ],
    });
    table.dropPins(0);
    expect(table.children.filter((child) => child.visible)).toHaveLength(1);
    table.dropPins(1);
    expect(table.children.filter((child) => child.visible)).toHaveLength(3);
    expect(table.anchor('pin1').x).toBeGreaterThan(table.anchor('pin0').x);
  });
});
