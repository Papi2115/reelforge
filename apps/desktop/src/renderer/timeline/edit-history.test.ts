import { describe, expect, it } from 'vitest';
import type { FileEdits, MoveBoundaryEdit } from '../../shared/timeline-contract.js';
import { applyBoundaryEdits, type ShotTimes } from '../../shared/timeline-edits.js';
import { EditHistory, MAX_HISTORY } from './edit-history.js';

/** Stand-in for main: applies storyboard edits strictly and answers with the inverse. */
class FakeMain {
  shots: ShotTimes[] = [
    { id: 's01', t0: 0, t1: 2 },
    { id: 's02', t0: 2, t1: 6 },
  ];

  apply(change: FileEdits): FileEdits {
    if (change.file !== 'storyboard') throw new Error('storyboard only');
    const applied = applyBoundaryEdits(this.shots, change.edits, 'strict');
    if (!applied.ok) throw new Error(applied.error);
    this.shots = applied.value.shots;
    return { file: 'storyboard', edits: applied.value.inverse };
  }

  get boundary(): number | undefined {
    return this.shots[0]?.t1;
  }
}

function move(from: number, to: number): FileEdits {
  const edit: MoveBoundaryEdit = { kind: 'move-boundary', left: 's01', right: 's02', from, to };
  return { file: 'storyboard', edits: [edit] };
}

describe('EditHistory', () => {
  it('undoes and redoes through the inverses main returns', () => {
    const main = new FakeMain();
    const history = new EditHistory();
    history.recordEdit(main.apply(move(2, 3)));
    history.recordEdit(main.apply(move(3, 4)));
    expect(main.boundary).toBe(4);

    const undo = (): void => {
      const change = history.takeUndo();
      if (change) history.recordUndo(main.apply(change));
    };
    const redo = (): void => {
      const change = history.takeRedo();
      if (change) history.recordRedo(main.apply(change));
    };
    undo();
    expect(main.boundary).toBe(3);
    undo();
    expect(main.boundary).toBe(2);
    expect(history.canUndo).toBe(false);
    redo();
    expect(main.boundary).toBe(3);
    redo();
    expect(main.boundary).toBe(4);
    expect(history.canRedo).toBe(false);
    undo();
    expect(main.boundary).toBe(3);

    // A new edit drops the redo branch.
    history.recordEdit(main.apply(move(3, 5)));
    expect(history.canRedo).toBe(false);
    undo();
    expect(main.boundary).toBe(3);
  });

  it('keeps at most MAX_HISTORY steps', () => {
    const history = new EditHistory();
    for (let index = 0; index < MAX_HISTORY + 5; index += 1)
      history.recordEdit(move(index, index + 1));
    let count = 0;
    while (history.takeUndo()) count += 1;
    expect(count).toBe(MAX_HISTORY);
    history.recordUndo(move(1, 2));
    history.clear();
    expect(history.canRedo).toBe(false);
  });
});
