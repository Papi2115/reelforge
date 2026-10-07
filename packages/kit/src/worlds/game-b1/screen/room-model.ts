/** The living room a shot asked for (`screen.room(spec)`, resolved times). */
export interface RoomModel {
  readonly calendar: { month: string; mark: number; ring: readonly [number, number] } | undefined;
  readonly tree: boolean;
  readonly presents: boolean;
  readonly gift:
    | {
        slot: readonly [number, number];
        tag: readonly string[];
        tagAt: readonly [number, number];
        blink: number | undefined;
      }
    | undefined;
  readonly lamp: boolean;
  readonly carts: number;
}
