/**
 * Esc order (docs/ux/redesign-2.4.md U12, docs/ui-copy.md "Keys"): every open dialog that closes
 * on Esc wherever the focus is takes a layer; only the newest (topmost) layer reacts, so one Esc
 * closes one dialog. Popovers and confirm boxes inside a dialog handle their Esc on the element and
 * stop it there (it never reaches the window). Esc never stops Claude. Pure.
 */

export class EscapeLayers {
  private readonly open: symbol[] = [];

  /** A new topmost layer. */
  push(): symbol {
    const layer = Symbol('escape-layer');
    this.open.push(layer);
    return layer;
  }

  remove(layer: symbol): void {
    const index = this.open.indexOf(layer);
    if (index !== -1) this.open.splice(index, 1);
  }

  isTop(layer: symbol): boolean {
    return this.open.at(-1) === layer;
  }
}
