/** Props of the kit (PLAN.md#3.3, batches A and B), in catalog order. */
import type { KitDefinition } from '../registry.js';
import { calculator } from './calculator.js';
import { character } from './character.js';
import { clock } from './clock.js';
import { crowd } from './crowd.js';
import { laptop, monitor } from './computers.js';
import { phone, usbStick } from './gadgets.js';
import { globe } from './globe.js';
import { drone, house } from './house.js';
import { building, tower } from './buildings.js';
import { container, warehouse } from './industrial.js';
import { mapTable } from './map-table.js';
import { documentStack, folder, paper } from './paperwork.js';
import { bench } from './school-desk.js';
import { lock, key } from './security.js';
import { server } from './server.js';
import { truck } from './truck.js';
import { cash, suitcase } from './valuables.js';
import { car, van } from './vehicles.js';

export const PROP_DEFINITIONS = [
  calculator,
  bench,
  paper,
  laptop,
  monitor,
  server,
  phone,
  folder,
  documentStack,
  cash,
  suitcase,
  lock,
  key,
  clock,
  globe,
  mapTable,
  usbStick,
  character,
  crowd,
  car,
  van,
  truck,
  container,
  warehouse,
  building,
  tower,
  house,
  drone,
] as const satisfies readonly KitDefinition[];

export type { PixelScreen } from './screen.js';
export { SCREEN_MODES, type ScreenMode } from './screen-content.js';
export type { PropMethods, PropObject } from './shared.js';
