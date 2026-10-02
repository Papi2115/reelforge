/**
 * Coalesces state pushes: a burst of changes becomes one `flush` after `delayMs`; `recompute`
 * requests are remembered until that flush (it re-reads the project first then).
 */
export class CoalescedPush {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private recompute = false;
  private disposed = false;

  constructor(
    private readonly delayMs: number,
    private readonly flush: (recompute: boolean) => Promise<void>,
  ) {}

  schedule(recompute: boolean): void {
    if (this.disposed) return;
    this.recompute ||= recompute;
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      const wanted = this.recompute;
      this.recompute = false;
      void this.flush(wanted);
    }, this.delayMs);
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
  }
}
