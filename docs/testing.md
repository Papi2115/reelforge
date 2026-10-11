# Testing: avoiding flaky tests

Commands are in `CLAUDE.md` §5. This page lists the patterns that keep tests stable on a loaded
Windows CI runner.

## Wait for state, never sleep

- Wait for the observable state you need, with a bounded timeout: `vi.waitFor(...)` in unit tests,
  `expect.poll(...)` / `locator.waitFor()` in the app tests. Never `setTimeout` and hope.
- An action is finished when its _effect_ is visible (a commit, a file on disk, the panel showing
  the saved value and its buttons enabled again), not when the click returned. Wait for that
  before the next action.
- In the app tests prefer `click()` + waiting for the saved result (commit, file) + polling the
  control's state over `check()`, which fails at once when a late reload flips the box back.
- A notice or event that is emitted after the state you waited for needs its own wait.
- A fixed pause is fine only to prove that something does _not_ happen within a window.

## Files on Windows

- A rename over a file another handle has open fails with `EPERM`/`EBUSY`, and opening a file
  while it is being replaced can fail with `EPERM`/`ENOENT`. Atomic writers retry the rename with a
  growing pause (10 × 25 ms × n, see `packages/project/src/atomic.ts`); test readers that race a
  writer tolerate these codes and read again.
- Within one process, reads of a `JsonFileStore` file are queued behind its pending writes, so a
  UI poll never makes the line's own write fail or see an empty queue.

## Retries

The app tests are retried on CI only (`vitest.config.ts`, `REELFORGE_CI=1`). A retry reruns
`beforeEach`, not `beforeAll`: a test that changes its project should launch the app and copy the
fixture in `beforeEach`, otherwise its retry starts from the state the failed attempt left.
