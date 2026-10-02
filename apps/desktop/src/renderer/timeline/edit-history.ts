/**
 * Undo/redo of timeline edits (PLAN.md#6.5). Every applied change comes back from main with its
 * inverse; undo sends that inverse, whose own inverse (from main again) is what redo sends. The
 * stacks therefore only ever hold "the edits to send next". Git history keeps every step too.
 */
import type { FileEdits } from '../../shared/timeline-contract.js';

export const MAX_HISTORY = 200;

export class EditHistory {
  private undoStack: FileEdits[] = [];
  private redoStack: FileEdits[] = [];

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** A new edit was applied: its inverse becomes undoable, the redo branch is dropped. */
  recordEdit(inverse: FileEdits): void {
    this.pushUndo(inverse);
    this.redoStack = [];
  }

  /** An undo was applied: its inverse becomes redoable. */
  recordUndo(inverse: FileEdits): void {
    this.redoStack.push(inverse);
    if (this.redoStack.length > MAX_HISTORY) this.redoStack.shift();
  }

  /** A redo was applied: its inverse becomes undoable again (the redo branch is kept). */
  recordRedo(inverse: FileEdits): void {
    this.pushUndo(inverse);
  }

  takeUndo(): FileEdits | undefined {
    return this.undoStack.pop();
  }

  takeRedo(): FileEdits | undefined {
    return this.redoStack.pop();
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private pushUndo(inverse: FileEdits): void {
    this.undoStack.push(inverse);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
  }
}
