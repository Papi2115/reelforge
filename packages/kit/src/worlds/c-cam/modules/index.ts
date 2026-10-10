/**
 * Grim Ink project modules (PLAN.md#14.8): people (`kit-ext/people/<id>.js`) and places
 * (`kit-ext/places/<id>.js`) built for each film, registered as `kit.people` / `kit.places` in the
 * world's shots. Public API of the folder (re-exported by the kit's index).
 */
export {
  INK_MODULE_ID,
  PERSON_FUNCTION_KEYS,
  PLACE_FUNCTION_KEYS,
  personDataSchema,
  personModuleSchema,
  placeBoxSchema,
  placeDataSchema,
  placeLightSchema,
  placeModuleSchema,
  armSettingsSchema,
  inkOptionsSchema,
  type ArmSetting,
  type ArmSettings,
  type InkJson,
  type InkJsonObject,
  type InkOptions,
  type PersonArms,
  type PersonBeforeHand,
  type PersonHeld,
  type PersonProps,
  type PersonData,
  type PersonHead,
  type PersonModule,
  type PersonNeck,
  type PersonTorso,
  type PlaceBox,
  type PlaceData,
  type PlaceDraw,
  type PlaceLight,
  type PlaceModule,
} from './contract.js';
export { inkTools, INK_TIME, type InkTools } from './ink-tools.js';
export {
  definePerson,
  personFromModule,
  type InkPerson,
  type PersonDrawOptions,
  type PersonHook,
  type ZoomEnv,
} from './person.js';
export { faceSpots, personGags, personProps } from './person-acting.js';
export { definePlace, placeFromModule, type InkPlace, type PlaceDrawOptions } from './place.js';
export {
  createInkModulesApi,
  inkRegistry,
  NO_INK_MODULES,
  type InkModules,
  type InkModulesApi,
  type InkRegistry,
} from './registry.js';
export { PERSON_SHEET_PAGES, PLACE_SHEET_PAGES, SHEET_T, placeFraming } from './sheet.js';
