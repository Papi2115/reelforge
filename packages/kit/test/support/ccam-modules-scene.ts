/**
 * Test scene for the Grim Ink people / places render test (PLAN.md#14.8): checks the sample
 * modules' namespaces (imported in the page from their sources, as the engine does) with the
 * kit's own loaders and paints one contact-sheet page of either into a 1920x1080 canvas, through
 * the same `sheet(g, page)` the `reelforge people-preview` / `places-preview` scenes call. Runs
 * inside the page (served by ccam-module-server.ts + ccam-zod-route.ts). Pure function of its inputs.
 */
import { asPaint2D } from '../../src/worlds/c-cam/draw/paint.js';
import { personFromModule } from '../../src/worlds/c-cam/modules/person.js';
import { placeFromModule } from '../../src/worlds/c-cam/modules/place.js';

/** Paints sheet page `page` of the person (`kind` people) or the place (places) into `ctx`. */
export function paintModuleSheet(
  ctx: CanvasRenderingContext2D,
  kind: 'people' | 'places',
  namespace: unknown,
  page: number,
): void {
  const g = asPaint2D(ctx);
  const item =
    kind === 'people'
      ? personFromModule(namespace, 'kit-ext/people/nightBaker.js')
      : placeFromModule(namespace, 'kit-ext/places/bakeryBackRoom.js');
  item.sheet(g, page);
}
